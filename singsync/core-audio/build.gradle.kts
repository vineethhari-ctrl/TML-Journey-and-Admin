plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
}
android {
    namespace = "app.singsync.core"
    compileSdk = 35
    defaultConfig {
        minSdk = 26
        consumerProguardFiles("consumer-rules.pro")
        externalNativeBuild { cmake { cppFlags += "-std=c++17"; arguments += "-DANDROID_STL=c++_shared" } }
        ndk { abiFilters += listOf("arm64-v8a", "x86_64") }  // armeabi-v7a dropped: ggml/whisper + ORT on 32-bit ARM is too slow to be useful
    }
    externalNativeBuild { cmake { path = file("src/main/cpp/CMakeLists.txt") } }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    api(project(":common"))
    implementation(libs.androidx.core.ktx)
}
