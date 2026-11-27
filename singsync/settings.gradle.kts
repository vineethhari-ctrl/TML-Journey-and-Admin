pluginManagement {
    repositories { mavenCentral(); gradlePluginPortal(); google() }
}
dependencyResolutionManagement {
    repositories { mavenCentral(); google() }
}
rootProject.name = "SingSync"

include(":common")
// Android modules need an Android SDK. `-PjvmOnly` lets the pure-JVM core be built/tested without one
// (used for fast local checks in sandboxes); CI builds everything.
if (!providers.gradleProperty("jvmOnly").isPresent) {
    include(":core-audio", ":ml", ":duet", ":ui", ":app")
}
