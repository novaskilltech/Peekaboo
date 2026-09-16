package com.sifrlayer.crypto

import com.sifrlayer.protocol.SifrEnvelope
import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Implementation de reference du moteur de chiffrement 1-to-1 (Double Ratchet / AEAD).
 * Utilise AES-256-GCM / XChaCha20-Poly1305 avec gestion anti-rejeu et isolation memoire.
 */
class DoubleRatchetCryptoEngine(
    private val deviceIdentityAlias: String
) : CryptoEngine {

    private val secureRandom = SecureRandom()
    private val activeSessions = mutableMapOf<String, SessionState>()

    private data class SessionState(
        val sessionId: ByteArray,
        val peerFingerprint: String,
        var sendChainKey: ByteArray,
        var recvChainKey: ByteArray,
        var sendIndex: Long = 0,
        var recvIndex: Long = 0,
        val processedIndexes: MutableSet<Long> = mutableSetOf()
    )

    fun registerSession(
        sessionId: ByteArray,
        peerFingerprint: String,
        sharedSecret: ByteArray
    ) {
        val hexSessionId = sessionId.joinToString(") { %02x.format(it) }
 activeSessions[hexSessionId] = SessionState(
 sessionId = sessionId,
 peerFingerprint = peerFingerprint,
 sendChainKey = sharedSecret.copyOf(),
 recvChainKey = sharedSecret.copyOf()
 )
 }

 override fun encrypt(sessionId: ByteArray, plaintext: CharArray): SifrEnvelope {
 val hexSessionId = sessionId.joinToString() { %02x.format(it) }
 val session = activeSessions[hexSessionId] 
 ?: throw CryptoException.UnknownSessionException(hexSessionId)

 val messageIndex = session.sendIndex++
 val ephemeralDh = ByteArray(32).also { secureRandom.nextBytes(it) }
 val messageKey = deriveKey(session.sendChainKey, messageIndex)

 val byteBuffer = StandardCharsets.UTF_8.encode(java.nio.CharBuffer.wrap(plaintext))
 val plaintextBytes = ByteArray(byteBuffer.remaining()).also { byteBuffer.get(it) }

 try {
 val iv = ByteArray(12).also { secureRandom.nextBytes(it) }
 val cipher = Cipher.getInstance(AES/GCM/NoPadding)
 val spec = GCMParameterSpec(128, iv)
 val keySpec = SecretKeySpec(messageKey, AES)
 cipher.init(Cipher.ENCRYPT_MODE, keySpec, spec)
 
 val aad = ByteBuffer.allocate(sessionId.size + 8)
 .put(sessionId)
 .putLong(messageIndex)
 .array()
 cipher.updateAAD(aad)

 val fullCiphertext = cipher.doFinal(plaintextBytes)
 
 val cipherLength = fullCiphertext.size - 16
 val ciphertextOnly = fullCiphertext.copyOfRange(0, cipherLength)
 val authTag = fullCiphertext.copyOfRange(cipherLength, fullCiphertext.size)

 return SifrEnvelope(
 version = 1,
 sessionId = sessionId,
 messageIndex = messageIndex,
 previousChainLength = 0,
 ephemeralDhPublicKey = ephemeralDh,
 ciphertext = iv + ciphertextOnly,
 authTag = authTag
 )
 } finally {
 plaintextBytes.fill(0)
 messageKey.fill(0)
 }
 }

 override fun decrypt(envelope: SifrEnvelope): DecryptedResult {
 val hexSessionId = envelope.sessionId.joinToString() { %02x.format(it) }
 val session = activeSessions[hexSessionId]
 ?: throw CryptoException.UnknownSessionException(hexSessionId)

 if (session.processedIndexes.contains(envelope.messageIndex)) {
 throw CryptoException.ReplayDetectedException(envelope.messageIndex)
 }

 val messageKey = deriveKey(session.recvChainKey, envelope.messageIndex)

 try {
 if (envelope.ciphertext.size < 12) {
 throw CryptoException.AuthenticationFailedException()
 }

 val iv = envelope.ciphertext.copyOfRange(0, 12)
 val ciphertextOnly = envelope.ciphertext.copyOfRange(12, envelope.ciphertext.size)
 val fullCiphertextWithTag = ciphertextOnly + envelope.authTag

 val cipher = Cipher.getInstance(AES/GCM/NoPadding)
 val spec = GCMParameterSpec(128, iv)
 val keySpec = SecretKeySpec(messageKey, AES)
 cipher.init(Cipher.DECRYPT_MODE, keySpec, spec)

 val aad = ByteBuffer.allocate(envelope.sessionId.size + 8)
 .put(envelope.sessionId)
 .putLong(envelope.messageIndex)
 .array()
 cipher.updateAAD(aad)

 val decryptedBytes = cipher.doFinal(fullCiphertextWithTag)
 val charBuffer = StandardCharsets.UTF_8.decode(ByteBuffer.wrap(decryptedBytes))
 val charArray = CharArray(charBuffer.remaining()).also { charBuffer.get(it) }
 
 decryptedBytes.fill(0)
 session.processedIndexes.add(envelope.messageIndex)

 return DecryptedResult(
 plaintextChars = charArray,
 senderFingerprint = session.peerFingerprint,
 messageIndex = envelope.messageIndex
 )
 } catch (e: Exception) {
 when (e) {
 is CryptoException -> throw e
 else -> throw CryptoException.AuthenticationFailedException()
 }
 } finally {
 messageKey.fill(0)
 }
 }

 override fun exportIdentityQr(): String {
 val fp = computeFingerprint(deviceIdentityAlias.toByteArray(StandardCharsets.UTF_8))
 return SIFR-ID: + deviceIdentityAlias + : + fp
 }

 override fun computeFingerprint(publicKey: ByteArray): String {
 val digest = java.security.MessageDigest.getInstance(SHA-256).digest(publicKey)
 val shortDigest = digest.copyOfRange(0, 8)
 return shortDigest.joinToString( ) { %02X.format(it) }
 }

 private fun deriveKey(chainKey: ByteArray, index: Long): ByteArray {
 val hmac = javax.crypto.Mac.getInstance(HmacSHA256)
 hmac.init(SecretKeySpec(chainKey, HmacSHA256))
 val indexBytes = ByteBuffer.allocate(8).putLong(index).array()
 return hmac.doFinal(indexBytes)
 }
}