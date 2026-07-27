# ADR 0009 — Verify webhook signatures over exact raw bytes

GitHub signatures cover the original byte sequence, so the Node route reads a
bounded raw stream and verifies HMAC-SHA256 before decoding or parsing JSON.
Constant-time comparison is used even for malformed digests. This prevents
whitespace or encoding normalization from changing the trust boundary.
