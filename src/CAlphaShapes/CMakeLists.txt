cmake_minimum_required(VERSION 3.16)
project(alphaShaper LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(CGAL REQUIRED COMPONENTS Core)
find_package(nlohmann_json CONFIG REQUIRED)

add_executable(alphaShaper alphaShaper.cpp)

target_link_libraries(alphaShaper
    PRIVATE
        CGAL::CGAL
        nlohmann_json::nlohmann_json
)
