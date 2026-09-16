package com.sifrlayer.ime

import android.inputmethodservice.InputMethodService
import android.view.View
import android.view.inputmethod.EditorInfo
import com.sifrlayer.crypto.CryptoEngine
import com.sifrlayer.protocol.EnvelopeSerializer

/**
 * Service IME sécurisé de SifrLayer.
 * Assure le cloisonnement strict : la zone de rédaction en clair réside exclusivement
 * dans la mémoire interne du clavier. Seul le ciphertext 🔐SL1:... est injecté
 * dans le champ de saisie de l''application hôte (WhatsApp, Telegram, etc.).
 */
class SifrInputMethodService : InputMethodService() {

    private var isSecureModeActive: Boolean = false
    private val localSecureBuffer = StringBuilder()
    
    // Injections de dépendances (moteurs cryptographiques et sérialisation)
    var cryptoEngine: CryptoEngine? = null
    var envelopeSerializer: EnvelopeSerializer? = null
    var activeSessionId: ByteArray? = null

    override fun onCreateInputView(): View {
        // En mode standard : vue de clavier standard
        // En mode Secure : bascule vers la zone de rédaction isolée SifrLayer
        return View(this)
    }

    override fun onStartInput(attribute: EditorInfo?, restarting: Boolean) {
        super.onStartInput(attribute, restarting)
        // Réinitialisation de sécurité du buffer local à chaque changement de champ cible
        wipeSecureBuffer()
    }

    /**
     * Action déclenchée par le bouton [ 🔐 Chiffrer et insérer ]
     */
    fun onEncryptAndInsertClicked() {
        val currentEngine = cryptoEngine ?: return
        val currentSerializer = envelopeSerializer ?: return
        val currentSessionId = activeSessionId ?: return
        val inputConnection = currentInputConnection ?: return

        if (localSecureBuffer.isEmpty()) return

        val plaintextChars = CharArray(localSecureBuffer.length)
        localSecureBuffer.getChars(0, localSecureBuffer.length, plaintextChars, 0)

        try {
            // 1. Chiffrement local via CryptoEngine (Double Ratchet)
            val envelope = currentEngine.encrypt(currentSessionId, plaintextChars)
            
            // 2. Sérialisation en chaîne de transport 🔐SL1:...
            val transportString = currentSerializer.serialize(envelope)

            // 3. Injection exclusive du ciphertext dans WhatsApp / Telegram
            inputConnection.commitText(transportString, 1)

            // 4. Purge immédiate de la zone de saisie
            wipeSecureBuffer()
        } finally {
            // Écrasement mémoire garanti du texte clair
            plaintextChars.fill(''\u0000'')
        }
    }

    fun appendSecureChar(c: Char) {
        localSecureBuffer.append(c)
    }

    fun wipeSecureBuffer() {
        for (i in 0 until localSecureBuffer.length) {
            localSecureBuffer.setCharAt(i, ''\u0000'')
        }
        localSecureBuffer.setLength(0)
    }

    override fun onDestroy() {
        wipeSecureBuffer()
        super.onDestroy()
    }
}