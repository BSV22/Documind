import os
import uuid
import shutil
import json
import hashlib
from pathlib import PurePath
import psycopg2
import psycopg2.extras
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from database import get_db_connection
from auth import get_current_user
from schemas import ChatRequest
from error_handlers import (
    ResourceNotFoundError, DatabaseError, ValidationError,
    ExternalServiceError, handle_database_error, handle_file_error,
    handle_gemini_error, log_error
)

# RAG module imports
from rag.document import MarkdownLoader, PDFLoader
from rag.chunker import TextChunker
from rag.embeddings import GeminiEmbedding
from rag.vector_store import VectorStore
from rag.retriever import Retriever
from rag.prompt import PromptBuilder
from rag.llm import LLM
from rag.response_cache import response_cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["documents"])

# Initialize global RAG components
store = VectorStore()
embedding = GeminiEmbedding()
retriever = Retriever(embedding, store)

@router.get("/documents")
def get_documents(current_user: dict = Depends(get_current_user)):
    """Retrieve all documents for the current user."""
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                cursor.execute("SELECT id, filename, upload_time FROM documents WHERE user_id = %s ORDER BY upload_time DESC", (current_user["id"],))
                rows = cursor.fetchall()
                logger.info(f"Retrieved {len(rows)} documents for user {current_user['id']}")
                return [dict(r) for r in rows]
    except psycopg2.Error as e:
        log_error(e, "get_documents database")
        raise handle_database_error(e)
    except Exception as e:
        log_error(e, "get_documents")
        raise DatabaseError("Failed to retrieve documents")

@router.post("/documents")
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload and index a PDF or Markdown document."""
    file_path = None
    doc_id = None
    
    try:
        # Validate file
        if not file.filename:
            raise ValidationError("Filename is required", "file")
        safe_filename = PurePath(file.filename.replace("\\", "/")).name
        extension = os.path.splitext(safe_filename)[1].lower()
        if extension not in {".pdf", ".md"}:
            raise ValidationError("Only PDF and Markdown (.md) files are allowed", "file")
        
        # Limit file size to 50MB
        MAX_FILE_SIZE = 50 * 1024 * 1024
        if file.size and file.size > MAX_FILE_SIZE:
            raise ValidationError("File size exceeds 50MB limit", "file")
        
        doc_id = str(uuid.uuid4())
        upload_dir = "/tmp" if os.environ.get("VERCEL") else "data/documents"
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, f"{doc_id}{extension}")
        
        # Save uploaded file
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            logger.info(f"File saved: {file_path} for user {current_user['id']}")
        except IOError as e:
            log_error(e, "upload_document file save")
            raise handle_file_error(e)
        
        # Extract text based on the validated file extension.
        try:
            loader = PDFLoader() if extension == ".pdf" else MarkdownLoader()
            document = loader.load(file_path)
            
            chunker = TextChunker()
            chunks = chunker.chunk(document)
            
            if not chunks or len(chunks) == 0:
                raise ValidationError("The file is empty or contains no extractable text")
            
            logger.info(f"{extension[1:].upper()} file chunked into {len(chunks)} parts")
        except ValidationError:
            raise
        except UnicodeDecodeError as e:
            if extension == ".md":
                raise ValidationError("Markdown files must use UTF-8 text encoding", "file") from e
            log_error(e, "upload_document PDF text extraction")
            raise ExternalServiceError("Document Processing", str(e)) from e
        except Exception as e:
            log_error(e, "upload_document text extraction")
            raise ExternalServiceError("Document Processing", str(e))
        
        # Generate embeddings
        try:
            embedding_model = GeminiEmbedding()
            embeddings = []
            for chunk in chunks:
                vector = embedding_model.embed(chunk)
                embeddings.append(vector)
            logger.info(f"Generated {len(embeddings)} embeddings")
        except Exception as e:
            log_error(e, "upload_document embeddings")
            raise handle_gemini_error(e)
        
        # Insert document metadata
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "INSERT INTO documents (id, filename, user_id) VALUES (%s, %s, %s)",
                        (doc_id, safe_filename, current_user["id"])
                    )
                conn.commit()
            logger.info(f"Document metadata inserted: {doc_id}")
        except psycopg2.Error as e:
            log_error(e, "upload_document insert metadata")
            raise handle_database_error(e)
        
        # Index chunks in vector store
        try:
            store.add_chunks_batch(chunks, embeddings, doc_id, current_user["id"])
            logger.info(f"Document indexed successfully: {doc_id}")
        except Exception as e:
            log_error(e, "upload_document chunk indexing")
            # Clean up the document record if chunk indexing fails
            try:
                with get_db_connection() as conn:
                    with conn.cursor() as cursor:
                        cursor.execute("DELETE FROM documents WHERE id = %s", (doc_id,))
                    conn.commit()
            except Exception as cleanup_error:
                logger.error(f"Failed to clean up document record: {cleanup_error}")
            
            raise ExternalServiceError("Vector Store", str(e))
        
        return {"id": doc_id, "filename": safe_filename}
    
    except (ValidationError, ExternalServiceError):
        # Clean up file if something went wrong
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.info(f"Cleaned up file: {file_path}")
            except Exception as e:
                logger.error(f"Failed to clean up file: {e}")
        raise
    except Exception as e:
        # Clean up file on any error
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as cleanup_error:
                logger.error(f"Failed to clean up file: {cleanup_error}")
        log_error(e, "upload_document")
        raise DatabaseError("Failed to process and index document")

@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a document and its associated data."""
    try:
        # Validate input
        if not doc_id or doc_id.strip() == "":
            raise ValidationError("Document ID is required", "doc_id")
        
        try:
            with get_db_connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                    # Verify user owns this document
                    cursor.execute("SELECT id, filename FROM documents WHERE id = %s AND user_id = %s", (doc_id, current_user["id"]))
                    doc = cursor.fetchone()
                    
                    if not doc:
                        raise ResourceNotFoundError("Document", doc_id)
        except psycopg2.Error as e:
            log_error(e, "delete_document verify ownership")
            raise handle_database_error(e)
        
        # Remove from vector store
        try:
            store.delete_document(doc_id)
            logger.info(f"Document removed from vector store: {doc_id}")
        except Exception as e:
            logger.warning(f"Failed to remove document from vector store: {e}")
            # Don't fail the entire delete operation if vector store removal fails
        
        # Remove uploaded file
        upload_dir = "/tmp" if os.environ.get("VERCEL") else "data/documents"
        extension = os.path.splitext(doc["filename"])[1].lower()
        if extension not in {".pdf", ".md"}:
            extension = ".pdf"
        file_path = os.path.join(upload_dir, f"{doc_id}{extension}")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.info(f"Deleted file: {file_path}")
            except OSError as e:
                log_error(e, "delete_document file removal")
                logger.warning(f"Failed to delete file: {file_path}")
                # Don't fail the entire delete operation if file deletion fails
        
        # Delete from database
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("DELETE FROM documents WHERE id = %s", (doc_id,))
                conn.commit()
            logger.info(f"Document deleted from database: {doc_id}")
        except psycopg2.Error as e:
            log_error(e, "delete_document database deletion")
            raise handle_database_error(e)
        
        return {"status": "success"}
    
    except (ValidationError, ResourceNotFoundError):
        raise
    except Exception as e:
        log_error(e, "delete_document")
        raise DatabaseError("Failed to delete document")

def detect_intent(message: str) -> str:
    """Route only obvious social messages away from document retrieval."""
    normalized = message.strip().lower().strip("!?.,")

    if normalized in {
        "hi", "hello", "hey", "good morning", "good afternoon", "good evening"
    }:
        return "GREETING"
    if normalized in {"how are you", "how are you doing", "what's up", "whats up"}:
        return "SMALL_TALK"

    # Factual, informational, and ambiguous messages must be grounded in documents.
    return "DOCUMENT_INQUIRY"

async def event_generator(
    chat_id: str,
    message: str,
    user_id: int,
    show_retrieved_chunks: bool = False,
):
    """Stream chat responses with error handling."""
    try:
        intent = detect_intent(message)
        response_cache_key = None
        accumulated_response = None

        if intent in {"GREETING", "SMALL_TALK"}:
            direct_response = "How may I help you?"
            prompt = None
            logger.info(f"Returning fixed response for {intent}")
        else:
            # Every factual or ambiguous question must use document context.
            direct_response = None
            prompt = None
            contexts = None
            
        if intent == "DOCUMENT_INQUIRY":
            # Tie cache entries to the current searchable corpus, so uploads and
            # deletions automatically produce different keys.
            try:
                with get_db_connection() as conn:
                    with conn.cursor() as cursor:
                        cursor.execute(
                            """
                            SELECT documents.id, COUNT(document_chunks.id)
                            FROM documents
                            LEFT JOIN document_chunks ON document_chunks.doc_id = documents.id
                            WHERE documents.user_id = %s OR documents.user_id IS NULL
                            GROUP BY documents.id
                            ORDER BY documents.id
                            """,
                            (user_id,),
                        )
                        corpus_fingerprint = [f"{row[0]}:{row[1]}" for row in cursor.fetchall()]

                normalized_question = " ".join(message.casefold().split())
                cache_material = json.dumps([
                    "rag-response-v1",
                    os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
                    str(user_id),
                    corpus_fingerprint,
                    normalized_question,
                ], ensure_ascii=False, separators=(",", ":"))
                response_cache_key = hashlib.sha256(cache_material.encode("utf-8")).hexdigest()
            except Exception as cache_key_error:
                # Cache lookup is optional; database/retrieval remains the source of truth.
                logger.warning("Could not build RAG response cache key: %s", cache_key_error)

            cached_response = response_cache.get(response_cache_key) if response_cache_key else None
            if cached_response is not None:
                logger.info("RAG response cache hit for user %s", user_id)
                accumulated_response = cached_response["text"]
                if show_retrieved_chunks and cached_response.get("sources"):
                    yield f"data: {json.dumps({'sources': cached_response['sources']})}\n\n"
                yield f"data: {json.dumps({'text': accumulated_response})}\n\n"
            else:
                accumulated_response = None

            # Retrieve top-5 contexts using hybrid semantic and keyword search.
            if cached_response is None:
                try:
                    contexts = retriever.retrieve(message, user_id=user_id, top_k=5)
                    logger.info(f"Retrieved {len(contexts)} contexts for document inquiry")
                    if contexts:
                        if show_retrieved_chunks:
                            sources = [
                                {"rank": index, "text": text}
                                for index, (_, text) in enumerate(contexts, start=1)
                            ]
                            yield f"data: {json.dumps({'sources': sources})}\n\n"
                        prompt = PromptBuilder().build(message, contexts)
                    else:
                        direct_response = "How may I help you?"
                except Exception as e:
                    log_error(e, "event_generator retrieval")
                    yield f"data: {json.dumps({'error': 'Failed to retrieve document context. ' + str(e)})}\n\n"
                    return

        if prompt is None and direct_response is None and accumulated_response is None:
            logger.error(f"Unable to build prompt for intent {intent}")
            yield f"data: {json.dumps({'error': 'Unable to process the request'})}\n\n"
            return

        if accumulated_response is None:
            accumulated_response = ""
            try:
                if direct_response is not None:
                    accumulated_response = direct_response
                    yield f"data: {json.dumps({'text': direct_response})}\n\n"
                else:
                    llm = LLM()
                    for chunk in llm.generate_stream(prompt):
                        accumulated_response += chunk
                        yield f"data: {json.dumps({'text': chunk})}\n\n"
                    if intent == "DOCUMENT_INQUIRY" and response_cache_key:
                        response_cache.set(response_cache_key, {
                            "text": accumulated_response,
                            "sources": [
                                {"rank": index, "text": text}
                                for index, (_, text) in enumerate(contexts or [], start=1)
                            ],
                        })
            except Exception as e:
                log_error(e, "event_generator llm streaming")
                logger.error(f"LLM stream generation failed: {e}")
                yield f"data: {json.dumps({'error': f'LLM error: {str(e)}' })}\n\n"
                return

        # Save messages to DB on completion
        user_msg_id = str(uuid.uuid4())
        bot_msg_id = str(uuid.uuid4())
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO messages (id, chat_id, from_user, text) VALUES (%s, %s, TRUE, %s)",
                        (user_msg_id, chat_id, message)
                    )
                    cur.execute(
                        "INSERT INTO messages (id, chat_id, from_user, text) VALUES (%s, %s, FALSE, %s)",
                        (bot_msg_id, chat_id, accumulated_response)
                    )
                conn.commit()
            logger.info(f"Chat messages saved for chat {chat_id}")
        except psycopg2.Error as db_e:
            log_error(db_e, "event_generator save messages")
            logger.error(f"Failed to save streamed chat messages to DB: {db_e}")
            # Don't fail the entire stream if DB save fails - response was already sent to user
        
        yield "data: [DONE]\n\n"
    
    except Exception as e:
        log_error(e, "event_generator general")
        logger.error(f"Unexpected error in event generator: {e}")
        yield f"data: {json.dumps({'error': 'An unexpected error occurred'})}\n\n"

@router.post("/chat")
def chat_query(req: ChatRequest, current_user: dict = Depends(get_current_user)):
    """Send a message and get streaming response."""
    try:
        # Validate input
        if not req.chat_id or req.chat_id.strip() == "":
            raise ValidationError("Chat ID is required", "chat_id")
        if not req.message or req.message.strip() == "":
            raise ValidationError("Message is required", "message")
        if len(req.message) > 5000:
            raise ValidationError("Message is too long (max 5000 characters)", "message")
        
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    # Verify user owns this chat
                    cursor.execute("SELECT id FROM chats WHERE id = %s AND user_id = %s", (req.chat_id, current_user["id"]))
                    if not cursor.fetchone():
                        raise ResourceNotFoundError("Chat", req.chat_id)
        except psycopg2.Error as e:
            log_error(e, "chat_query verify ownership")
            raise handle_database_error(e)
        
        logger.info(f"Starting chat query for chat {req.chat_id}, user {current_user['id']}")
        return StreamingResponse(
            event_generator(
                req.chat_id,
                req.message,
                current_user["id"],
                req.show_retrieved_chunks,
            ),
            media_type="text/event-stream"
        )
    
    except (ValidationError, ResourceNotFoundError):
        raise
    except Exception as e:
        log_error(e, "chat_query")
        raise DatabaseError("Failed to process chat query")
