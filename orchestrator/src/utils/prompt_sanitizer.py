"""
Prompt Sanitizer

Implements prompt injection prevention and input sanitization for LLM safety.

Defense Strategy:
- Remove control sequences and special markers
- Escape prompt-sensitive syntax
- Enforce length limits
- Filter malicious patterns
- Whitelist expected token types
"""

import re
import logging
from typing import Optional
from html import escape

logger = logging.getLogger(__name__)

# Dangerous control sequences commonly used in prompt injection attacks
DANGEROUS_PATTERNS = [
    # System prompt override attempts
    r"(?i)(ignore previous|disregard|forget|override|system\s*prompt|hidden\s*instruction)",
    # Instruction injection markers
    r"(?i)(instruction:|task:|role:|you\s*are|pretend\s*to|act\s*as|play\s*as)",
    # Output manipulation attempts
    r"(?i)(output.*format|return.*only|respond.*as|say.*only)",
    # Jailbreak attempt markers
    r"(?i)(roleplay|scenario|hypothetical|what\s*if|imagine)",
    # LLM manipulation (for Claude, GPT, etc.)
    r"(?i)(claude|gpt|assistant|ai|model).*(?:do|say|generate|write|output)",
    # SQL injection patterns in context
    r"(?i)(union\s+select|drop\s+table|delete\s+from|insert\s+into)",
    # Code injection attempts
    r"exec\(|eval\(|subprocess|os\.system|__import__",
]

# System prompt escape sequences commonly targeted
SYSTEM_MARKERS = [
    "SYSTEM:",
    "[SYSTEM]",
    "<system>",
    "ASSISTANT:",
    "[ASSISTANT]",
    "<assistant>",
    "HUMAN:",
    "[HUMAN]",
    "<human>",
    "---",
    "```",
    "END CONVERSATION",
]

# Length limits to prevent token exhaustion
MAX_INPUT_LENGTH = 4000  # Characters
MAX_TOKENS_ESTIMATE = 1000  # Rough estimate: 1 char ≈ 0.25 tokens, so 4000 chars ≈ 1000 tokens


class PromptSanitizationResult:
    """Result of prompt sanitization"""

    def __init__(self, text: str, is_safe: bool, violations: list[str], sanitized_text: str):
        self.text = text
        self.is_safe = is_safe
        self.violations = violations
        self.sanitized_text = sanitized_text
        self.original_length = len(text)
        self.sanitized_length = len(sanitized_text)

    def __repr__(self) -> str:
        return f"PromptSanitizationResult(safe={self.is_safe}, violations={len(self.violations)})"


class PromptSanitizer:
    """
    Multi-layered input sanitization for LLM safety.

    Layers:
    1. Length validation (prevent token exhaustion)
    2. Pattern detection (known injection attacks)
    3. System marker escape (prevent prompt override)
    4. Special character encoding (HTML escape where needed)
    5. Whitespace normalization (prevent hidden injections)
    """

    def __init__(self, strict_mode: bool = False):
        """
        Initialize prompt sanitizer.

        Args:
            strict_mode: If True, reject any input with violations.
                        If False, sanitize and allow (log violations).
        """
        self.strict_mode = strict_mode
        self._compile_patterns()

    def _compile_patterns(self) -> None:
        """Pre-compile regex patterns for performance"""
        self.dangerous_regex = [re.compile(pattern) for pattern in DANGEROUS_PATTERNS]
        self.system_marker_regex = re.compile(
            "|".join(re.escape(marker) for marker in SYSTEM_MARKERS)
        )

    def sanitize(self, text: str) -> PromptSanitizationResult:
        """
        Sanitize input text for LLM safety.

        Process:
        1. Check length limits
        2. Detect dangerous patterns
        3. Escape system markers
        4. Normalize whitespace
        5. Return result with safety assessment

        Args:
            text: User input to sanitize

        Returns:
            PromptSanitizationResult with sanitized text and violation list
        """
        violations = []
        sanitized_text = text

        # Layer 1: Length validation
        if len(text) > MAX_INPUT_LENGTH:
            violations.append(
                f"Input exceeds maximum length ({len(text)} > {MAX_INPUT_LENGTH} chars)"
            )
            if self.strict_mode:
                return PromptSanitizationResult(
                    text=text,
                    is_safe=False,
                    violations=violations,
                    sanitized_text=sanitized_text,
                )
            # Truncate in non-strict mode
            sanitized_text = sanitized_text[:MAX_INPUT_LENGTH]

        # Layer 2: Detect dangerous patterns
        for regex in self.dangerous_regex:
            matches = regex.findall(sanitized_text)
            if matches:
                violations.append(f"Dangerous pattern detected: {matches[0]}")

        # Layer 3: Escape system markers
        escaped_count = 0
        for marker in SYSTEM_MARKERS:
            if marker in sanitized_text:
                sanitized_text = sanitized_text.replace(marker, f"\\{marker}")
                escaped_count += 1

        if escaped_count > 0:
            violations.append(f"Escaped {escaped_count} system markers")

        # Layer 4: Remove null bytes and control characters
        sanitized_text = self._remove_control_characters(sanitized_text)

        # Layer 5: Normalize whitespace to prevent hidden injections
        sanitized_text = self._normalize_whitespace(sanitized_text)

        # Determine safety
        is_safe = len(violations) == 0

        if not is_safe:
            if self.strict_mode:
                logger.warn(
                    "Input rejected due to safety violations",
                    extra={"violations": violations, "text_preview": text[:100]},
                )
            else:
                logger.warn(
                    "Input sanitized due to violations",
                    extra={
                        "violations": violations,
                        "original_length": len(text),
                        "sanitized_length": len(sanitized_text),
                    },
                )

        return PromptSanitizationResult(
            text=text,
            is_safe=is_safe or not self.strict_mode,  # Strict mode rejects, permissive sanitizes
            violations=violations,
            sanitized_text=sanitized_text,
        )

    def is_safe(self, text: str) -> bool:
        """Quick safety check without full sanitization"""
        result = self.sanitize(text)
        return result.is_safe

    def get_sanitized(self, text: str) -> str:
        """Get sanitized text"""
        result = self.sanitize(text)
        return result.sanitized_text

    # ============================================
    # Private Helpers
    # ============================================

    def _remove_control_characters(self, text: str) -> str:
        """Remove null bytes and dangerous control characters"""
        # Remove null bytes
        text = text.replace("\x00", "")
        
        # Remove other control characters (ASCII 0-31 except common ones)
        allowed_control = {"\t", "\n", "\r"}
        result = ""
        for char in text:
            if ord(char) < 32 and char not in allowed_control:
                result += " "  # Replace with space
            else:
                result += char
        
        return result

    def _normalize_whitespace(self, text: str) -> str:
        """
        Normalize whitespace to prevent hidden injections.

        Examples of hidden injections:
        - Multiple spaces before system marker
        - Tabs instead of spaces
        - Unicode whitespace characters
        """
        # Replace multiple spaces with single space
        text = re.sub(r" {2,}", " ", text)
        
        # Replace tabs with spaces
        text = text.replace("\t", " ")
        
        # Replace other Unicode whitespace with space
        text = re.sub(r"[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]", " ", text)
        
        # Strip leading/trailing whitespace
        text = text.strip()
        
        return text


# Singleton instance
_sanitizer: Optional[PromptSanitizer] = None


def get_sanitizer(strict_mode: bool = False) -> PromptSanitizer:
    """Get or create prompt sanitizer singleton"""
    global _sanitizer
    
    if _sanitizer is None or _sanitizer.strict_mode != strict_mode:
        _sanitizer = PromptSanitizer(strict_mode=strict_mode)
    
    return _sanitizer


def sanitize_prompt(text: str, strict_mode: bool = False) -> PromptSanitizationResult:
    """
    Sanitize a prompt string.

    Args:
        text: Input text to sanitize
        strict_mode: If True, reject any unsafe input

    Returns:
        PromptSanitizationResult with sanitized text and violations
    """
    sanitizer = get_sanitizer(strict_mode=strict_mode)
    return sanitizer.sanitize(text)


def is_prompt_safe(text: str) -> bool:
    """Quick check: is prompt safe?"""
    sanitizer = get_sanitizer()
    return sanitizer.is_safe(text)


def get_sanitized_prompt(text: str) -> str:
    """Get sanitized version of prompt"""
    sanitizer = get_sanitizer()
    return sanitizer.get_sanitized(text)
