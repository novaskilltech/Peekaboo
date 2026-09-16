package com.sifrlayer.crypto

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class DoubleRatchetCryptoEngineTest {

    private val engine = DoubleRatchetCryptoEngine(Pixel10-TestDevice)
    private val sessionId = byteArrayOf(10, 20, 30, 40, 50, 60, 70, 80, 1, 2, 3, 4, 5, 6, 7, 8)
    private val sharedSecret = ByteArray(32) { 0x42.toByte() }

    init {
        engine.registerSession(
            sessionId = sessionId,
            peerFingerprint = AA BB CC DD EE FF 11 22,
            sharedSecret = sharedSecret
        )
    }

    @Test
    fun testNominalEncryptionAndDecryption() {
        // Test A : Le clair est transformé en ciphertext et fidèlement restitué
        val secretMessage = Rendez-vous demain a 15h au bureau..toCharArray()
        val envelope = engine.encrypt(sessionId, secretMessage)

        val result = engine.decrypt(envelope)
        assertEquals(Rendez-vous demain a 15h au bureau., String(result.plaintextChars))
        assertEquals(0L, result.messageIndex)

        // Vérification de la purge mémoire
        result.wipe()
        assertTrue(result.plaintextChars.all { it == '\u0000' })
    }

    @Test
    fun testTamperedCiphertextRejection() {
        // Test C : Modification d'un caractère du ciphertext -> Échec authentification
        val secretMessage = Confidentiel défense.toCharArray()
        val envelope = engine.encrypt(sessionId, secretMessage)

        // Altération d'un octet dans le payload chiffré
        envelope.ciphertext[14] = (envelope.ciphertext[14].toInt() xor 0xFF).toByte()

        assertFailsWith<CryptoException.AuthenticationFailedException> {
            engine.decrypt(envelope)
        }
    }

    @Test
    fun testAntiReplayProtection() {
        // Test anti-rejeu : Un même message rejoué doit être rejeté
        val secretMessage = Transaction unique.toCharArray()
        val envelope = engine.encrypt(sessionId, secretMessage)

        // Premier déchiffrement OK
        engine.decrypt(envelope)

        // Deuxième déchiffrement -> ReplayDetectedException
        assertFailsWith<CryptoException.ReplayDetectedException> {
            engine.decrypt(envelope)
        }
    }

    @Test
    fun testUnknownSessionRejection() {
        // Test D : Tentative de déchiffrement avec une session inconnue
        val foreignSessionId = ByteArray(16) { 0x99.toByte() }
        val secretMessage = Message secret.toCharArray()

        assertFailsWith<CryptoException.UnknownSessionException> {
            engine.encrypt(foreignSessionId, secretMessage)
        }
    }
}