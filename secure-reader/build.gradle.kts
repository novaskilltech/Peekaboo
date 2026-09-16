plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = com.sifrlayer.reader
    compileSdk = 34

    defaultConfig {
        minSdk = 26
    }
}

dependencies {
    implementation(project(:protocol-envelope))
    implementation(project(:crypto-core))
    implementation(libs.androidx.biometric)
    implementation(libs.androidx.core.ktx)
}