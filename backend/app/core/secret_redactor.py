import re
from typing import Tuple, List

# Pre-compiled high-confidence secret patterns
SECRET_PATTERNS = [
    # Private RSA / EC / PGP keys
    (re.compile(r"-----BEGIN [A-Z0-9_ ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9_ ]*PRIVATE KEY-----"), "[REDACTED_PRIVATE_KEY]"),
    # OpenAI API Keys
    (re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_\-]{20,}\b"), "[REDACTED_OPENAI_KEY]"),
    # Groq API Keys
    (re.compile(r"\bgsk_[A-Za-z0-9_\-]{16,}\b"), "[REDACTED_GROQ_KEY]"),
    # GitHub Personal Access Tokens & OAuth
    (re.compile(r"\b(gh[pousr]_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{50,})\b"), "[REDACTED_GITHUB_TOKEN]"),
    # AWS Access Key ID
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "[REDACTED_AWS_KEY_ID]"),
    # AWS Secret Access Key
    (re.compile(r"(?i)(aws_secret_access_key|aws_secret_key)\s*[:=]\s*['\"]?([A-Za-z0-9\/+=]{40})['\"]?"), r"\1=[REDACTED_AWS_SECRET]"),
    # Slack Bot / User Tokens
    (re.compile(r"\bxox[baprs]-[0-9a-zA-Z\-]{10,}\b"), "[REDACTED_SLACK_TOKEN]"),
    # Generic credential assignments in code / env
    (re.compile(r"(?i)\b(api[_-]?key|client[_-]?secret|auth[_-]?token|bearer_token|password|passwd)\s*[:=]\s*['\"]([^'\"\s]{8,})['\"]"), r"\1='[REDACTED_SECRET]'"),
]

def redact_secrets(text: str) -> Tuple[str, bool]:
    """
    Scans code or diff strings for sensitive credentials, API keys, and private keys.
    Returns (sanitized_text, was_redacted).
    Guarantees secrets are never dispatched to external LLMs or logged in plain text.
    """
    if not text or not isinstance(text, str):
        return text or "", False

    sanitized = text
    was_redacted = False

    for pattern, replacement in SECRET_PATTERNS:
        if pattern.search(sanitized):
            sanitized = pattern.sub(replacement, sanitized)
            was_redacted = True

    return sanitized, was_redacted

def redact_payload_secrets(obj: any) -> Tuple[any, bool]:
    """Recursively redacts secrets across nested dictionaries, lists, and strings."""
    if isinstance(obj, str):
        return redact_secrets(obj)
    elif isinstance(obj, dict):
        new_dict = {}
        any_redacted = False
        for k, v in obj.items():
            new_v, r = redact_payload_secrets(v)
            new_dict[k] = new_v
            if r:
                any_redacted = True
        return new_dict, any_redacted
    elif isinstance(obj, list):
        new_list = []
        any_redacted = False
        for item in obj:
            new_item, r = redact_payload_secrets(item)
            new_list.append(new_item)
            if r:
                any_redacted = True
        return new_list, any_redacted
    return obj, False
