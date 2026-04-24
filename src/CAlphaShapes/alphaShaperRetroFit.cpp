//// filepath: l:\PotreeRep\next\nextMA\PotreeNext_MA\src\CAlphaShapes\alphaShaperRetrofit.cpp
//lot of code taken from example: https://cgal.geometryfactory.com/CGAL/doc/main/Advancing_front_surface_reconstruction/index.html#Chapter_Advancing_Front_Surface_Reconstruction
#include <iostream>
#include <fstream>
#include <vector>
#include <string>
#include <iterator>
#include <algorithm>
#include <filesystem>
#include <chrono>

#include <nlohmann/json.hpp>
#include <CGAL/Exact_predicates_inexact_constructions_kernel.h>
#include <CGAL/Advancing_front_surface_reconstruction.h>
using json = nlohmann::json;


//CGAL TYPES
typedef CGAL::Exact_predicates_inexact_constructions_kernel 	K;
typedef CGAL::Advancing_front_surface_reconstruction<> 			Reconstruction;
typedef Reconstruction::Triangulation_3 						Triangulation_3;
typedef Reconstruction::Triangulation_data_structure_2 			TDS_2;
typedef K::Point_3 												Point_3;
typedef K::Vector_3 											Vector_3;

int main() {
    json in;
    try {
        std::cin >> in;
    } catch (const std::exception& e) {
        std::cerr << "Failed to parse JSON: " << e.what() << std::endl;
        return 1;
    }

    if (!in.contains("points") || !in["points"].is_array()) {
        std::cerr << "Input JSON missing 'points' array\n";
        return 1;
    }
	//get the dang points c:
	std::vector<Point_3> pts;
	pts.reserve(in["points"].size());
	for (const auto& p : in["points"]) {
		pts.emplace_back(
			p.at("x").get<double>(),
			p.at("y").get<double>(),
			p.at("z").get<double>()
		);
	}

    json out;
    out["num_points"] = pts.size();
	json triangles = json::array();
	double area = 0.0;
	//time taking
	using Clock = std::chrono::steady_clock;
	auto beforeAlphaGeneration = Clock::now();

  	Triangulation_3 dt(pts.begin(), pts.end());
	Reconstruction reconstruction(dt);
	reconstruction.run();
	const TDS_2& tds = reconstruction.triangulation_data_structure_2();

	for(TDS_2::Face_iterator fit = tds.faces_begin();
		fit != tds.faces_end();
		++fit){
		if(reconstruction.has_on_surface(fit)){
			Triangulation_3::Facet f = fit->facet();
			Triangulation_3::Cell_handle ch = f.first;
			int ci = f.second;
			Point_3 points[3];
			for(int i = 0, j = 0; i < 4; i++){
				if(ci != i){
				points[j] = ch->vertex(i)->point();
				j++;
				}
			}
		//just add up the area. interestingly enough, i could only find squared_area. fun.
		//apparently math. robustness?
		double triArea = std::sqrt(
			CGAL::to_double(CGAL::squared_area(points[0], points[1], points[2])));
		area += triArea;
		//one entry: one triangle
		json tri = json::array();
		tri.push_back({{"x", points[0].x()}, {"y", points[0].y()}, {"z", points[0].z()}});
		tri.push_back({{"x", points[1].x()}, {"y", points[1].y()}, {"z", points[1].z()}});
		tri.push_back({{"x", points[2].x()}, {"y", points[2].y()}, {"z", points[2].z()}});
		triangles.push_back(tri);
		}
	}
//time taken
	auto afterResultPushOut = Clock::now();
	out["timing_ms"] = std::chrono::duration_cast<std::chrono::milliseconds>(
		afterResultPushOut - beforeAlphaGeneration
		).count();
	out["num_triangles"] = triangles.size();
	out["triangles"] = triangles;
	out["area"] = area;
    std::cout << out.dump();
    return 0;
}