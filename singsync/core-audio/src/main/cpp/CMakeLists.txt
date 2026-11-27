cmake_minimum_required(VERSION 3.22)
project(singcore LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Portable core: no Android deps (iOS port reuses this target as-is).
add_library(singcore_static STATIC singcore.cpp)
target_include_directories(singcore_static PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
set_target_properties(singcore_static PROPERTIES POSITION_INDEPENDENT_CODE ON)

if(ANDROID)
  add_library(singcore SHARED jni_bridge.cpp)
  target_link_libraries(singcore singcore_static log)
else()
  # Host build for tests:  cmake -S core-audio/src/main/cpp -B build-host && cmake --build build-host && ctest --test-dir build-host
  enable_testing()
  add_executable(singcore_test ../../test/cpp/singcore_test.cpp)
  target_link_libraries(singcore_test singcore_static)
  add_test(NAME singcore_test COMMAND singcore_test)
endif()
