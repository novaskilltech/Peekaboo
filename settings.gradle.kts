pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = SifrLayer

include(:protocol-envelope)
include(:crypto-core)
include(:key-storage)
include(:secure-ime)
include(:secure-reader)
include(:app)
