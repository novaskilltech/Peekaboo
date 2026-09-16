package com.sifrlayer.reader

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.WindowManager
import com.sifrlayer.crypto.CryptoEngine
import com.sifrlayer.crypto.DecryptedResult
import com.sifrlayer.protocol.EnvelopeSerializer

/**
 * Lecteur sécurisé SifrLayer.
 * - Active FLAG_SECURE (interdiction des captures d''écran et masquage dans le multitâche).
 * - Lecture explicite du presse-papiers uniquement à l''action de l''utilisateur.
 * - Purge automatique du clair lors de la fermeture ou mise en pause de l''écran.
 */
class SecureReaderActivity : Activity() {

    var cryptoEngine: CryptoEngine? = null
    var envelopeSerializer: EnvelopeSerializer? = null
    private var currentDecryptedResult: DecryptedResult? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Verrouillage anti-capture et anti-recents
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )
    }

    /**
     * Déclenché explicitement par l''utilisateur (bouton Déchiffrer le presse-papiers)
     */
    fun decryptClipboardContent(): CharArray? {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return null
        val clip = clipboard.primaryClip ?: return null
        if (clip.itemCount == 0) return null

        val rawText = clip.getItemAt(0).text?.toString() ?: return null
        
        val serializer = envelopeSerializer ?: return null
        val engine = cryptoEngine ?: return null

        return try {
            val envelope = serializer.deserialize(rawText)
            val result = engine.decrypt(envelope)
            currentDecryptedResult = result
            result.plaintextChars
        } catch (e: Exception) {
            // Journalisation technique sans aucune fuite de contenu
            null
        }
    }

    override fun onPause() {
        super.onPause()
        // Écrasement immédiat de la mémoire dès que l''utilisateur quitte l''écran
        currentDecryptedResult?.wipe()
        currentDecryptedResult = null
    }

    override fun onDestroy() {
        currentDecryptedResult?.wipe()
        currentDecryptedResult = null
        super.onDestroy()
    }
}