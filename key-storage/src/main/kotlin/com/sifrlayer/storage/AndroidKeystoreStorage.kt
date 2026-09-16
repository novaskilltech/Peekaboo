package com.sifrlayer.storage

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyPairGenerator
import java.security.KeyStore

/**
 * Gestionnaire du matériel de clés adossé au TEE / StrongBox d''Android Keystore.
 * Les clés privées sont matériellement non-exportables hors de l''enclave sécurisée.
 */
class AndroidKeystoreStorage : SecureKeyStorage {

    private val keyStore = KeyStore.getInstance(AndroidKeyStore).apply { load(null) }

    override fun getOrCreateMasterKeyAlias(): String {
        val alias = SifrLayerMasterIdentityKey
        if (!keyStore.containsAlias(alias)) {
            val keyPairGenerator = KeyPairGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_EC, 
                AndroidKeyStore
            )
            val parameterSpec = KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
            )
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(false) // Validation biométrique gérée au niveau session
                .build()

            keyPairGenerator.initialize(parameterSpec)
            keyPairGenerator.generateKeyPair()
        }
        return alias
    }

    override fun storeIdentityKeyPair(alias: String, privateKeyBytes: ByteArray, publicKeyBytes: ByteArray) {
        // Dans une enclave Keystore matérielle, l''injection externe est restreinte :
        // La génération locale via KeyPairGenerator est la méthode privilégiée.
    }

    override fun getIdentityPublicKey(alias: String): ByteArray? {
        val certificate = keyStore.getCertificate(alias) ?: return null
        return certificate.publicKey.encoded
    }

    override fun wipeKey(alias: String) {
        if (keyStore.containsAlias(alias)) {
            keyStore.deleteEntry(alias)
        }
    }
}