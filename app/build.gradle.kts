plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = com.sifrlayer.app
    compileSdk = 34

    defaultConfig {
        applicationId = com.sifrlayer.app
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = 1.0
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile(proguard-android-optimize.txt),
                proguard-rules.pro
            )
        }
    }
}

dependencies {
    implementation(project(:protocol-envelope))
    implementation(project(:crypto-core))
    implementation(project(:key-storage))
    implementation(project(:secure-ime))
    implementation(project(:secure-reader))
    implementation(libs.androidx.core.ktx)
}