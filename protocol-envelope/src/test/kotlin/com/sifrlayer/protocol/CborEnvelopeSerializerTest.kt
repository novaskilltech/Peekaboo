package com.sifrlayer.protocol

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class CborEnvelopeSerializerTest {

    private val serializer = CborEnvelopeSerializer()

    private val sampleEnvelope = SifrEnvelope(
        version = 1,
        sessionId = byteArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16),
        messageIndex = 42L,
        previousChainLength = 10L,
        ephemeralDhPublicKey = ByteArray(32) { 0xAA.toByte() },
        ciphertext = Test ciphertext payload.toByteArray(Charsets.UTF_8),
        authTag = ByteArray(16) { 0xEE.toByte() }
    )

    @Test
    fun testSerializationRoundTrip() {
        val transportString = serializer.serialize(sampleEnvelope)
        assertTrue(transportString.startsWith(🔐SL1:))

        val deserialized = serializer.deserialize(transportString)
        assertEquals(sampleEnvelope.version, deserialized.version)
        assertEquals(sampleEnvelope.messageIndex, deserialized.messageIndex)
        assertEquals(sampleEnvelope.previousChainLength, deserialized.previousChainLength)
        assertTrue(sampleEnvelope.sessionId.contentEquals(deserialized.sessionId))
        assertTrue(sampleEnvelope.ephemeralDhPublicKey.contentEquals(deserialized.ephemeralDhPublicKey))
        assertTrue(sampleEnvelope.ciphertext.contentEquals(deserialized.ciphertext))
        assertTrue(sampleEnvelope.authTag.contentEquals(deserialized.authTag))
    }

    @Test
    fun testInvalidPrefixRejection() {
        assertFailsWith<EnvelopeException.InvalidPrefixException> {
            serializer.deserialize(INVALID_PREFIX:abc123payload)
        }
    }

    @Test
    fun testTamperedPayloadRejection() {
        val validTransportString = serializer.serialize(sampleEnvelope)
        // Test C : Altération d'un caractère du Base64URL
        val tampered = validTransportString.substring(0, validTransportString.length - 2) + ==
        
        assertFailsWith<EnvelopeException.DeserializationException> {
            serializer.deserialize(tampered)
        }
    }
}
