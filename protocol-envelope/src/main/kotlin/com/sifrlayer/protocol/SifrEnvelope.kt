package com.sifrlayer.protocol

import kotlinx.serialization.Serializable

@Serializable
data class SifrEnvelope(
    val version: Int = 1,
    val sessionId: ByteArray,
    val messageIndex: Long,
    val previousChainLength: Long,
    val ephemeralDhPublicKey: ByteArray,
    val ciphertext: ByteArray,
    val authTag: ByteArray
) {
    companion object {
        const val PREFIX = 🔐SL1:
    }
}

sealed class EnvelopeException(message: String) : Exception(message) {
    class InvalidPrefixException : EnvelopeException(Prefix does not match SifrLayer v1 header)
    class DeserializationException(cause: Throwable) : EnvelopeException(Failed to decode CBOR payload: )
    class SerializationException(cause: Throwable) : EnvelopeException(Failed to encode envelope to CBOR: )
}

interface EnvelopeSerializer {
    fun serialize(envelope: SifrEnvelope): String
    fun deserialize(transportString: String): SifrEnvelope
}
