import '../../domain/six_eight/models.dart';

/// Pre-loaded tournament match presets matching official 6-8 Sports tournament setups.
class TournamentPresets {
  TournamentPresets._();

  static final TournamentMatch match68JO = TournamentMatch(
    matchId: '68-JO-2026-412',
    tournamentName: 'USA Water Polo Junior Olympics (Platinum)',
    venue: 'Stanford Avery Aquatic Center • Pool 1',
    division: '18U Boys Championship',
    teamWhiteName: 'VANGUARD',
    teamWhiteClub: 'Huntington Beach Vanguard WP',
    teamDarkName: 'STANFORD',
    teamDarkClub: 'Stanford Water Polo Foundation',
    whiteRoster: const [
      RosterPlayer(capNumber: 1, name: 'L. Azevedo', position: Position.gk, piScore: 84.2, steals: 2),
      RosterPlayer(capNumber: 2, name: 'M. Vavic', position: Position.atk, piScore: 81.5, goals: 2, personalFouls: 1, steals: 1),
      RosterPlayer(capNumber: 3, name: 'C. Dodd', position: Position.ctr, piScore: 88.9, goals: 3, personalFouls: 1, steals: 2),
      RosterPlayer(capNumber: 4, name: 'R. Daube', position: Position.utl, piScore: 86.1, goals: 2, personalFouls: 2, steals: 0),
      RosterPlayer(capNumber: 5, name: 'B. Hallock', position: Position.ctr, piScore: 91.4, goals: 2, personalFouls: 0, steals: 1),
      RosterPlayer(capNumber: 6, name: 'L. Cupido', position: Position.def, piScore: 85.0, goals: 1, personalFouls: 1, steals: 2),
      RosterPlayer(capNumber: 7, name: 'A. Bowen', position: Position.atk, piScore: 83.7, goals: 1, personalFouls: 0, steals: 1),
      RosterPlayer(capNumber: 8, name: 'D. Woodhead', position: Position.def, piScore: 79.8, goals: 0, personalFouls: 1, steals: 0),
      RosterPlayer(capNumber: 9, name: 'J. Ehrhardt', position: Position.def, piScore: 77.5, goals: 0, personalFouls: 0, steals: 1),
      RosterPlayer(capNumber: 10, name: 'M. Irving', position: Position.atk, piScore: 82.9, goals: 0, personalFouls: 0, steals: 1),
      RosterPlayer(capNumber: 11, name: 'T. Gruwell', position: Position.utl, piScore: 76.4, goals: 0, personalFouls: 0, steals: 0),
      RosterPlayer(capNumber: 12, name: 'N. Saveljic', position: Position.atk, piScore: 80.1, goals: 0, personalFouls: 0, steals: 0),
    ],
    darkRoster: const [
      RosterPlayer(capNumber: 1, name: 'A. Weinberg', position: Position.gk, piScore: 86.8, steals: 3),
      RosterPlayer(capNumber: 2, name: 'J. Hooper', position: Position.atk, piScore: 84.5, goals: 2, personalFouls: 1, steals: 1),
      RosterPlayer(capNumber: 3, name: 'T. Abramson', position: Position.atk, piScore: 82.1, goals: 2, personalFouls: 0, steals: 1),
      RosterPlayer(capNumber: 4, name: 'J. Painter', position: Position.utl, piScore: 79.3, goals: 1, personalFouls: 2, steals: 0),
      RosterPlayer(capNumber: 5, name: 'S. Jensen', position: Position.ctr, piScore: 80.6, goals: 1, personalFouls: 1, steals: 1),
      RosterPlayer(capNumber: 6, name: 'R. Pittman', position: Position.def, piScore: 78.9, goals: 1, personalFouls: 1, steals: 2),
      RosterPlayer(capNumber: 7, name: 'E. Churnside', position: Position.atk, piScore: 77.2, goals: 1, personalFouls: 0, steals: 0),
      RosterPlayer(capNumber: 8, name: 'G. West', position: Position.def, piScore: 75.8, goals: 1, personalFouls: 0, steals: 1),
      RosterPlayer(capNumber: 9, name: 'K. Larsen', position: Position.ctr, piScore: 79.0, goals: 0, personalFouls: 1, steals: 0),
      RosterPlayer(capNumber: 10, name: 'C. McFarland', position: Position.utl, piScore: 76.1, goals: 0, personalFouls: 0, steals: 0),
      RosterPlayer(capNumber: 11, name: 'W. Schneider', position: Position.def, piScore: 74.5, goals: 0, personalFouls: 0, steals: 0),
      RosterPlayer(capNumber: 12, name: 'Z. Cordes', position: Position.atk, piScore: 75.2, goals: 0, personalFouls: 0, steals: 0),
    ],
  );

  static final TournamentMatch match68ODP = TournamentMatch(
    matchId: '68-ODP-2026-108',
    tournamentName: '6-8 Sports ODP National Championship',
    venue: 'Woollett Aquatics Center • Irvine, CA',
    division: 'Women Senior National Showcase',
    teamWhiteName: 'PAC-SW',
    teamWhiteClub: 'Pacific Southwest Zone ODP',
    teamDarkName: 'COASTAL',
    teamDarkClub: 'Coastal California Zone ODP',
    whiteRoster: const [
      RosterPlayer(capNumber: 1, name: 'A. Johnson', position: Position.gk, piScore: 92.1, steals: 4),
      RosterPlayer(capNumber: 2, name: 'M. Musselman', position: Position.atk, piScore: 90.4, goals: 3, personalFouls: 1, steals: 2),
      RosterPlayer(capNumber: 3, name: 'T. Prentice', position: Position.ctr, piScore: 85.2, goals: 2, personalFouls: 1, steals: 0),
      RosterPlayer(capNumber: 4, name: 'R. Fattal', position: Position.utl, piScore: 89.7, goals: 2, personalFouls: 0, steals: 2),
      RosterPlayer(capNumber: 5, name: 'J. Flynn', position: Position.atk, piScore: 86.3, goals: 2, personalFouls: 2, steals: 1),
      RosterPlayer(capNumber: 6, name: 'M. Steffens', position: Position.def, piScore: 93.0, goals: 1, personalFouls: 1, steals: 3),
      RosterPlayer(capNumber: 7, name: 'J. Neushul', position: Position.atk, piScore: 84.1, goals: 1, personalFouls: 0, steals: 1),
      RosterPlayer(capNumber: 8, name: 'K. Gilchrist', position: Position.def, piScore: 83.5, goals: 0, personalFouls: 1, steals: 1),
    ],
    darkRoster: const [
      RosterPlayer(capNumber: 1, name: 'A. Longan', position: Position.gk, piScore: 88.4, steals: 2),
      RosterPlayer(capNumber: 2, name: 'E. Ausmus', position: Position.def, piScore: 87.9, goals: 2, personalFouls: 1, steals: 2),
      RosterPlayer(capNumber: 3, name: 'J. Roemer', position: Position.atk, piScore: 85.6, goals: 2, personalFouls: 1, steals: 1),
      RosterPlayer(capNumber: 4, name: 'R. Lineback', position: Position.utl, piScore: 84.2, goals: 2, personalFouls: 0, steals: 1),
      RosterPlayer(capNumber: 5, name: 'A. Sekulic', position: Position.ctr, piScore: 82.8, goals: 1, personalFouls: 2, steals: 0),
      RosterPlayer(capNumber: 6, name: 'H. Constandse', position: Position.atk, piScore: 81.0, goals: 1, personalFouls: 0, steals: 1),
      RosterPlayer(capNumber: 7, name: 'I. Gazzaniga', position: Position.ctr, piScore: 80.4, goals: 1, personalFouls: 1, steals: 0),
      RosterPlayer(capNumber: 8, name: 'S. Stryker', position: Position.atk, piScore: 79.5, goals: 0, personalFouls: 0, steals: 1),
    ],
  );

  static final TournamentMatch match68KAP7 = TournamentMatch(
    matchId: '68-KAP7-2026-889',
    tournamentName: 'Kap7 International Classic • 6-8 Challenge',
    venue: 'Marguerite Aquatics Center • Mission Viejo',
    division: 'Varsity Boys Gold Division',
    teamWhiteName: 'NEWPORT',
    teamWhiteClub: 'Newport Harbor Aquatics',
    teamDarkName: 'J-SERRA',
    teamDarkClub: 'JSerra Catholic Water Polo',
    whiteRoster: const [
      RosterPlayer(capNumber: 1, name: 'C. Kennedy', position: Position.gk, piScore: 81.2, steals: 2),
      RosterPlayer(capNumber: 2, name: 'P. Castillo', position: Position.ctr, piScore: 84.0, goals: 3, personalFouls: 1, steals: 1),
      RosterPlayer(capNumber: 3, name: 'G. Gottlieb', position: Position.atk, piScore: 79.4, goals: 2, personalFouls: 1, steals: 1),
      RosterPlayer(capNumber: 4, name: 'L. Bettis', position: Position.def, piScore: 78.1, goals: 1, personalFouls: 2, steals: 1),
      RosterPlayer(capNumber: 5, name: 'K. Briscoe', position: Position.utl, piScore: 77.6, goals: 1, personalFouls: 0, steals: 0),
    ],
    darkRoster: const [
      RosterPlayer(capNumber: 1, name: 'H. Fredericks', position: Position.gk, piScore: 82.5, steals: 3),
      RosterPlayer(capNumber: 2, name: 'B. Dodd', position: Position.atk, piScore: 87.3, goals: 4, personalFouls: 1, steals: 2),
      RosterPlayer(capNumber: 3, name: 'T. Anderson', position: Position.ctr, piScore: 81.9, goals: 2, personalFouls: 1, steals: 0),
      RosterPlayer(capNumber: 4, name: 'W. Vey', position: Position.def, piScore: 79.0, goals: 1, personalFouls: 2, steals: 1),
      RosterPlayer(capNumber: 5, name: 'J. Plumb', position: Position.utl, piScore: 78.4, goals: 1, personalFouls: 0, steals: 1),
    ],
  );

  static List<TournamentMatch> get allMatches => [match68JO, match68ODP, match68KAP7];

  static TournamentMatch get defaultMatch => match68JO;

  static TournamentMatch? getMatchById(String matchId) {
    for (final m in allMatches) {
      if (m.matchId == matchId) return m;
    }
    return null;
  }
}
