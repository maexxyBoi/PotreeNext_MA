//// filepath: l:\PotreeRep\next\nextMA\PotreeNext_MA\src\CAlphaShapes\alphaShaper.cpp
#include <iostream>
#include <vector>
#include <string>
#include <iterator>

#include <nlohmann/json.hpp>

#include <CGAL/Exact_predicates_inexact_constructions_kernel.h>
#include <CGAL/Alpha_shape_3.h>
#include <CGAL/Alpha_shape_vertex_base_3.h>
#include <CGAL/Alpha_shape_cell_base_3.h>
#include <CGAL/Triangulation_vertex_base_3.h>
#include <CGAL/Triangulation_cell_base_3.h>
#include <CGAL/Triangulation_data_structure_3.h>
#include <CGAL/Delaunay_triangulation_3.h>
#include <CGAL/Polygon_mesh_processing/measure.h> 

using json = nlohmann::json;

// kernel
typedef CGAL::Exact_predicates_inexact_constructions_kernel K;
typedef K::Point_3                                         Point;

// alpha-shape aware triangulation
typedef CGAL::Alpha_shape_vertex_base_3<K>                 AsVb;
typedef CGAL::Alpha_shape_cell_base_3<K>                   AsCb;
typedef CGAL::Triangulation_data_structure_3<AsVb, AsCb>   Tds;
typedef CGAL::Delaunay_triangulation_3<K, Tds>             Dt;
typedef CGAL::Alpha_shape_3<Dt>                            Alpha_shape_3;
typedef Alpha_shape_3::Facet                               Facet;

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

    double alpha = 0.0;
    if (in.contains("alpha")) {
        alpha = in["alpha"].get<double>();
    }

    std::vector<Point> pts;
    pts.reserve(in["points"].size());
    double cx = 0.0, cy = 0.0, cz = 0.0; // for centroid, i need them later for integration
    for (const auto& p : in["points"]) {
        double x = p.at("x").get<double>();
        double y = p.at("y").get<double>();
        double z = p.at("z").get<double>();
        pts.emplace_back(x, y, z);
        cx += x; cy += y; cz += z;
    }

    json out;
    out["num_points"] = pts.size();

    if (pts.size() < 4) {
        out["triangles"] = json::array();
        out["used_alpha"] = alpha;
        out["num_triangles"] = 0;
        out["volume"] = 0.0;
		out["testVol"] = 0.0;
        std::cout << out.dump();
        return 0;
    }

    cx /= pts.size();
    cy /= pts.size();
    cz /= pts.size();
    Point ref(cx, cy, cz);

    // Build alpha shape without fixed alpha first
    Alpha_shape_3 A(pts.begin(), pts.end(), Alpha_shape_3::GENERAL);

    // Choose alpha:
    // - if user-provided alpha > 0, try that
    // - otherwise, pick a middle alpha from CGAL's alpha spectrum
    if (alpha > 0.0) {
        A.set_alpha(alpha);
    } else if (A.number_of_alphas() > 0) {
        std::size_t n = A.number_of_alphas();
        auto it = A.alpha_begin();
        std::advance(it, n / 2); // middle alpha
        A.set_alpha(*it);
        alpha = *it;
    }

    out["used_alpha"] = alpha;

    json triangles = json::array();
    double volume = 0.0;
	int i = 0;
	Point a(0.0, 0.0, 0.0);
	Point b(1.0, 1.0, 1.0);
	Point c(1.0, 1.0, 0.0);
	Point d(1.0, 0.0, 1.0);

	double testVol = CGAL::to_double(CGAL::volume(a, b, c, d));
	for (auto cit = A.finite_cells_begin(); cit != A.finite_cells_end(); ++cit) {
		auto clas = A.classify(cit);
		if (clas == Alpha_shape_3::INTERIOR ) {
			const Point& p0 = cit->vertex(0)->point();
			const Point& p1 = cit->vertex(1)->point();
			const Point& p2 = cit->vertex(2)->point();
			const Point& p3 = cit->vertex(3)->point();
			if (i < 2){
				json tri = json::array();
				tri.push_back({ {"x", p0.x()}, {"y", p0.y()}, {"z", p0.z()} });
				tri.push_back({ {"x", p1.x()}, {"y", p1.y()}, {"z", p1.z()} });
				tri.push_back({ {"x", p2.x()}, {"y", p2.y()}, {"z", p2.z()} });
				tri.push_back({ {"x", p3.x()}, {"y", p3.y()}, {"z", p3.z()} });
				i++;
				triangles.push_back(tri);
				// CGAL has a tetrahedron volume helper:
			}
			double v = CGAL::to_double(CGAL::volume(p0, p1, p2, p3));
			volume += v;
		}
	}

	//out["volume"] = std::abs(volume);

    /*for (auto it = A.alpha_shape_facets_begin();
         it != A.alpha_shape_facets_end(); ++it) {

        Facet f = *it;
        Alpha_shape_3::Cell_handle cell = f.first;
        int i = f.second;

        int ids[3];
        int k = 0;
        for (int v = 0; v < 4; ++v) {
            if (v == i) continue;
            ids[k++] = v;
        }

        Point p0 = cell->vertex(ids[0])->point();
        Point p1 = cell->vertex(ids[1])->point();
        Point p2 = cell->vertex(ids[2])->point();

        // accumulate volume via tetrahedron (ref, p0, p1, p2)
        K::Vector_3 v0 = p0 - ref;
        K::Vector_3 v1 = p1 - ref;
        K::Vector_3 v2 = p2 - ref;
        K::Vector_3 cp = CGAL::cross_product(v1, v2);
        double vTet = CGAL::to_double(v0 * cp) / 6.0;
        volume += vTet;

        json tri = json::array();
        tri.push_back({ {"x", p0.x()}, {"y", p0.y()}, {"z", p0.z()} });
        tri.push_back({ {"x", p1.x()}, {"y", p1.y()}, {"z", p1.z()} });
        tri.push_back({ {"x", p2.x()}, {"y", p2.y()}, {"z", p2.z()} });

        triangles.push_back(tri);
    }*/

    out["num_triangles"] = triangles.size();
    out["triangles"] = triangles;
    out["volume"] = std::abs(volume); // alpha-shape enclosed volume
	out["testVol"] = testVol;

    std::cout << out.dump();
    return 0;
}