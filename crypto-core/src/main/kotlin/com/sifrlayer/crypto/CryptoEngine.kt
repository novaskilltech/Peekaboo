package com.sifrlayer.crypto

import com.sifrlayer.protocol.SifrEnvelope

data class SessionIdentity(
    val peerId: String,
    val peerFingerprint: String,
    val identityPublicKey: ByteArray
)

data class DecryptedResult(
    val plaintextChars: CharArray,
    val senderFingerprint: String,
    val messageIndex: Long
) {
    fun wipe() {
        plaintextChars.fill('\u0000')
    }
}

sealed class CryptoException(message: String) : Exception(message) {
    class UnknownSessionException(val sessionIdHex: String) : CryptoException(Session not found: )
    class AuthenticationFailedException : CryptoException(Ciphertext authentication failed (tampered message))
    class ReplayDetectedException(val index: Long) : CryptoException(Message index already processed: )
    class IdentityChangedException(val peerId: String) : CryptoException(Identity key changed for contact: )
}

interface CryptoEngine {
    @Throws(CryptoException::class)
    fun encrypt(
        sessionId: ByteArray,
        plaintext: CharArray
    ): SifrEnvelope

    @Throws(CryptoException::class)
    fun decrypt(
        envelope: SifrEnvelope
    ): DecryptedResult

    fun exportIdentityQr(): String
    fun computeFingerprint(publicKey: ByteArray): String
}
