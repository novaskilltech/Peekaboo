plugins {
    alias(libs.plugins.kotlin.jvm)
}

dependencies {
    implementation(project(:protocol-envelope))
    testImplementation(kotlin(test))
}
