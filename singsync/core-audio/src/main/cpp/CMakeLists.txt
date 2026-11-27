cmake_minimum_required(VERSION 3.22)
project(singcore LANGUAGES C CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Portable core: no Android deps (iOS port reuses this target as-is).
add_library(singcore_static STATIC singcore.cpp)
target_include_directories(singcore_static PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
set_target_properties(singcore_static PROPERTIES POSITION_INDEPENDENT_CODE ON)

if(ANDROID)
  # whisper.cpp is fetched by CI (git clone --branch v1.7.5) into singsync/third_party/whisper.cpp.
  # Without it the JNI still builds and WhisperNative.nativeAvailable() returns false.
  set(WHISPER_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../../third_party/whisper.cpp" CACHE PATH "whisper.cpp checkout")
  set(JNI_SOURCES jni_bridge.cpp whisper_jni.cpp)
  add_library(singcore SHARED ${JNI_SOURCES})
  target_link_libraries(singcore singcore_static log)

  if(EXISTS "${WHISPER_DIR}/CMakeLists.txt")
    message(STATUS "whisper.cpp found at ${WHISPER_DIR}")
    # Debug APKs must still be fast: ggml at -O0 is unusable.
    set(CMAKE_C_FLAGS_DEBUG "-O3 -DNDEBUG")
    set(CMAKE_CXX_FLAGS_DEBUG "-O3 -DNDEBUG")
    set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
    set(WHISPER_BUILD_TESTS OFF CACHE BOOL "" FORCE)
    set(WHISPER_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
    set(WHISPER_BUILD_SERVER OFF CACHE BOOL "" FORCE)
    set(GGML_NATIVE OFF CACHE BOOL "" FORCE)      # cross-compiling: never -march=native
    set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
    set(GGML_LLAMAFILE OFF CACHE BOOL "" FORCE)
    add_subdirectory(${WHISPER_DIR} whisper_build EXCLUDE_FROM_ALL)
    target_link_libraries(singcore whisper)
    target_compile_definitions(singcore PRIVATE SING_HAVE_WHISPER=1)
    target_include_directories(singcore PRIVATE ${WHISPER_DIR}/include ${WHISPER_DIR}/ggml/include)
  else()
    message(WARNING "whisper.cpp NOT found – building without speech recognition")
  endif()
else()
  # Host build for tests:  cmake -S core-audio/src/main/cpp -B build-host && cmake --build build-host && ctest --test-dir build-host
  enable_testing()
  add_executable(singcore_test ../../test/cpp/singcore_test.cpp)
  target_link_libraries(singcore_test singcore_static)
  add_test(NAME singcore_test COMMAND singcore_test)
endif()
