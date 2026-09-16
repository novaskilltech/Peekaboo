package com.sifrlayer.protocol

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.cbor.Cbor
import kotlinx.serialization.decodeFromByteArray
import kotlinx.serialization.encodeToByteArray
import java.util.Base64

@OptIn(ExperimentalSerializationApi::class)
class CborEnvelopeSerializer : EnvelopeSerializer {

    private val cbor = Cbor {
        ignoreUnknownKeys = false
        encodeDefaults = true
    }

    private val base64Encoder = Base64.getUrlEncoder().withoutPadding()
    private val base64Decoder = Base64.getUrlDecoder()

    override fun serialize(envelope: SifrEnvelope): String {
        return try {
            val cborBytes = cbor.encodeToByteArray(envelope)
            val base64 = base64Encoder.encodeToString(cborBytes)
            "
 } catch (e: Exception) {
 throw EnvelopeException.SerializationException(e)
 }
 }

 override fun deserialize(transportString: String): SifrEnvelope {
 val trimmed = transportString.trim()
 if (!trimmed.startsWith(SifrEnvelope.PREFIX)) {
 throw EnvelopeException.InvalidPrefixException()
 }

 val base64Payload = trimmed.removePrefix(SifrEnvelope.PREFIX)
 return try {
 val cborBytes = base64Decoder.decode(base64Payload)
 cbor.decodeFromByteArray<SifrEnvelope>(cborBytes)
 } catch (e: Exception) {
 throw EnvelopeException.DeserializationException(e)
 }
 }
}
