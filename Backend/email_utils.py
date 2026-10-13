import smtplib
from html import escape
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD

def send_otp_email(
    to_email: str, otp_code: str, email_type: str = "verification"
) -> bool:
    """
    Sends an OTP verification email to the user.
    If SMTP variables are not configured or connection fails,
    it falls back to printing the OTP to the console logs.
    """
    if not all([SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD]):
        print(f"\n==========================================")
        print(f"[OTP Verification Fallback] Code for {to_email} is: {otp_code}")
        print(f"==========================================\n")
        return False
        
    try:
        is_password_reset = email_type == "password_reset"
        if is_password_reset:
            subject = "Your Documind password reset code"
            heading = "Reset your password"
            intro = "Use this secure code to choose a new password for your Documind account."
            action = "Password reset code"
            plain_body = f"""Hi there,

We received a request to reset your Documind password.

Your password reset code is: {otp_code}

This code expires in 10 minutes. If you did not request this, you can safely ignore this email. Your password will not change unless this code is used.

The Documind Team
"""
        else:
            subject = "Verify your email for Documind"
            heading = "One quick check"
            intro = "Thanks for joining Documind. Verify your email to unlock your private document workspace."
            action = "Email verification code"
            plain_body = f"""Hi there,

Welcome to Documind! Enter this verification code to finish creating your account: {otp_code}

This code expires in 10 minutes. If you did not create a Documind account, you can safely ignore this email.

The Documind Team
"""

        safe_otp = escape(otp_code)
        msg = MIMEMultipart("alternative")
        msg['From'] = SMTP_USER
        msg['To'] = to_email
        msg['Subject'] = subject

        html_body = f"""\
<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="color-scheme" content="dark">
        <title>{escape(heading)}</title>
    </head>
    <body style="margin:0;padding:0;background-color:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#e6edf3;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{escape(intro)}</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0d1117;padding:36px 12px;">
            <tr><td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#161b22;border:1px solid #30363d;border-radius:16px;overflow:hidden;">
                    <tr><td style="height:4px;background-color:#2f81f7;font-size:0;line-height:0;">&nbsp;</td></tr>
                    <tr><td style="padding:30px 34px 10px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                            <td align="center" valign="middle" width="38" height="38" style="width:38px;height:38px;border-radius:10px;background-color:#2f81f7;color:#ffffff;font-size:20px;font-weight:700;">D</td>
                            <td style="padding-left:12px;color:#e6edf3;font-size:17px;font-weight:650;letter-spacing:-0.2px;">Documind</td>
                        </tr></table>
                    </td></tr>
                    <tr><td style="padding:22px 34px 34px;">
                        <p style="margin:0 0 10px;color:#58a6ff;font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">{'Account security' if is_password_reset else 'Welcome aboard'}</p>
                        <h1 style="margin:0 0 12px;color:#e6edf3;font-size:27px;line-height:1.25;font-weight:650;">{escape(heading)}</h1>
                        <p style="margin:0 0 26px;color:#8b949e;font-size:15px;line-height:1.7;">{escape(intro)}</p>
                        <p style="margin:0 0 10px;color:#8b949e;font-size:12px;font-weight:600;letter-spacing:0.4px;">{escape(action)}</p>
                        <div style="padding:18px 20px;border:1px solid #30363d;border-radius:12px;background-color:#0d1117;text-align:center;">
                            <span style="color:#e6edf3;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:9px;">{safe_otp}</span>
                        </div>
                        <p style="margin:13px 0 24px;color:#8b949e;font-size:12px;line-height:1.6;">This code expires in <strong style="color:#c9d1d9;">10 minutes</strong>. For your security, never share it with anyone.</p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #30363d;">
                            <tr><td style="padding-top:20px;color:#8b949e;font-size:12px;line-height:1.7;">{'If you did not request a password reset, ignore this message. Your password will remain unchanged.' if is_password_reset else 'If you did not request a Documind account, you can safely ignore this email.'}</td></tr>
                        </table>
                    </td></tr>
                </table>
                <p style="margin:18px 0 0;color:#6e7681;font-size:11px;line-height:1.6;">Sent by Documind · Private knowledge, thoughtfully organized.</p>
            </td></tr>
        </table>
    </body>
</html>
"""
        msg.attach(MIMEText(plain_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))
        
        # Connect and send email
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, msg.as_string())
        
        print(f"Verification email successfully sent to {to_email}.")
        return True
    except Exception as e:
        print(f"Error sending verification email: {e}")
        # Log to terminal as a fallback so local dev / test suites don't break
        print(f"\n==========================================")
        print(f"[OTP Verification Fallback] Code for {to_email} is: {otp_code}")
        print(f"==========================================\n")
        return False
