"""All user-facing refusal strings (exact)."""
CROSS_USER = "I can only provide information associated with your authenticated account."
SYSTEM_PROMPT = "I can't share my internal instructions."
INJECTION = "I can't help with that request. I can help with your policies, claims, payments, or general insurance questions."
OUT_OF_SCOPE = "I can only help with insurance questions and your own account."
SENSITIVE = "I can't share that information."
UNVERIFIED = "I couldn't verify that information. Please try asking again."
RATE_LIMIT = "Too many requests. Please wait a moment and try again."
LOCKOUT = "Chat is temporarily unavailable for your account due to repeated blocked requests. Please try again later."
ERROR = "Something went wrong. Please try again."

# Not in the spec table: shown when a conversation is full or the tool-iteration cap is hit.
CONVERSATION_FULL = "This conversation has reached its message limit. Please start a new chat."
INCOMPLETE = "I wasn't able to complete that request."
