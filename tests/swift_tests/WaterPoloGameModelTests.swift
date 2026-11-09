import XCTest
@testable import PoloBridge

final class WaterPoloGameModelTests: XCTestCase {
    func testInitialState() {
        let model = WaterPoloGameModel()
        XCTAssertEqual(model.gameClockTenths, 4200)
        XCTAssertEqual(model.shotClockTenths, 300)
        XCTAssertEqual(model.homeScore, 0)
        XCTAssertEqual(model.awayScore, 0)
        XCTAssertFalse(model.isShotClockBlanked)
    }

    func testShotClockBlankingRuleWP20_15() {
        let model = WaterPoloGameModel()
        model.gameClockTenths = 150 // 15.0s remaining in period
        model.shotClockTenths = 300 // 30.0s shot clock
        XCTAssertTrue(model.isShotClockBlanked)
        XCTAssertEqual(model.formattedShotClock, "--")
    }

    func testThreeFoulCapOutAndGoalExclusionRelease() {
        let model = WaterPoloGameModel()
        model.addExclusion(team: "AWAY", cap: 8)
        model.addExclusion(team: "AWAY", cap: 8)
        model.addExclusion(team: "AWAY", cap: 8)
        XCTAssertEqual(model.foulCount(team: "AWAY", cap: 8), 3)
        XCTAssertTrue(model.isCappedOut(team: "AWAY", cap: 8))

        // 4th exclusion for capped-out player should be blocked
        model.addExclusion(team: "AWAY", cap: 8)
        XCTAssertEqual(model.foulCount(team: "AWAY", cap: 8), 3)

        // Scoring a goal for HOME releases defending (AWAY) exclusions
        model.addGoal(isHome: true)
        XCTAssertEqual(model.exclusions.filter { $0.team == "AWAY" }.count, 0)
    }
}
