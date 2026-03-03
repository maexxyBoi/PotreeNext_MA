#include <iostream>
#include <vector>
#include <string>

#include <nlohmann/json.hpp>  // from vcpkg: nlohmann-json

using json = nlohmann::json;

int main() {
    json in;
    try {
        std::cin >> in;
    } catch (const std::exception& e) {
        std::cerr << "Failed to parse JSON: " << e.what() << std::endl;
        return 1;
    }

    // later: compute CGAL alpha shape here
    json out;
    out["received_points"] = in["points"].size();
    out["alpha"] = in["alpha"];

    std::cout << out.dump();
    return 0;
}