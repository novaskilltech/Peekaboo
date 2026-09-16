package com.sifrlayer.storage

interface SecureKeyStorage {
    fun getOrCreateMasterKeyAlias(): String
    fun storeIdentityKeyPair(alias: String, privateKeyBytes: ByteArray, publicKeyBytes: ByteArray)
    fun getIdentityPublicKey(alias: String): ByteArray?
    fun wipeKey(alias: String)
}

sealed class KeyStorageException(message: String) : Exception(message) {
    class KeystoreUnavailableException(cause: Throwable) : KeyStorageException(Android Keystore hardware unavailable: )
    class KeyNotFoundException(val alias: String) : KeyStorageException(Key alias not found: )
}
