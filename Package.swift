// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PoloBridge",
    platforms: [
        .iOS(.v16),
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "PoloPadCore",
            targets: ["PoloPadCore"]
        )
    ],
    targets: [
        .target(
            name: "PoloPadCore",
            path: "ipad_app",
            exclude: ["Info.plist"]
        )
    ]
)
