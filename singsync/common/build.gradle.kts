plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
}
java { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
dependencies {
    implementation(libs.kotlinx.serialization.json)
    // ORT API only: Android gets onnxruntime-android at runtime, JVM tests use the desktop artifact (same ai.onnxruntime package)
    compileOnly(libs.onnxruntime.jvm)
    testImplementation(libs.onnxruntime.jvm)
    testImplementation(libs.junit)
}
tasks.test { useJUnit() }
