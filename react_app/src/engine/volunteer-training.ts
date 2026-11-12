/**
 * PoloBridge & PoloPad Pro — Volunteer Table Quick-Start & Training Simulator Engine
 *
 * Provides the official referee whistle & hand signal decoder, the 30s vs. 20s Shot Clock
 * Reset Decision Matrix (World Aquatics WP 20.16 / USAWP / NCAA vs. NFHS High School),
 * and an interactive 8-scenario pool-deck training simulator for volunteer parents.
 */

export interface WhistleSignalSpec {
  id: string;
  whistlePattern: string;
  handSignal: string;
  meaning: string;
  tableAction: string;
  audioType: 'short' | 'double' | 'long' | 'trill';
}

export interface ResetDecisionRule {
  situation: string;
  usawpNcaaFina: '30s' | '20s' | 'No Reset';
  nfhsHighSchool: '30s' | '20s' | 'No Reset';
  notes: string;
}

export interface TrainingScenario {
  id: string;
  title: string;
  gameTimeDisplay: string;
  shotTimeDisplay: string;
  ruleset: 'USAWP / NCAA (30s & 20s)' | 'NFHS High School (30s Only)';
  refereeSignal: string;
  description: string;
  correctAction: 'RESET_30' | 'RESET_20' | 'HOLD_CLOCK' | 'STOP_CLOCK';
  explanation: string;
}

export const REFEREE_WHISTLE_SIGNALS: WhistleSignalSpec[] = [
  {
    id: 'ordinary-foul',
    whistlePattern: '1 Short Blast (📯)',
    handSignal: 'Arm pointing in attack direction, hand horizontal',
    meaning: 'Ordinary Foul — Free Throw Awarded',
    tableAction: 'DO NOT reset shot clock. Clock continues running once ball is put in play.',
    audioType: 'short',
  },
  {
    id: 'turnover-foul',
    whistlePattern: '1 Sharp Blast (📯)',
    handSignal: 'Arm pointing in opposite direction (change of possession)',
    meaning: 'Offensive Foul / Ball Under / Turnover',
    tableAction: 'Tap [30s RESET] immediately! Possession has changed to the defending team.',
    audioType: 'short',
  },
  {
    id: 'exclusion-foul',
    whistlePattern: '2 Quick Blasts + 1 Long Blast (📯📯—📯)',
    handSignal: 'Pointing at player, then sweeping arm toward re-entry corner',
    meaning: '20-Second Exclusion Foul (Rule WP 21)',
    tableAction: 'Stop Clock -> Enter Cap # in Exclusion Modal -> Resets Shot Clock to 20s (USAWP/NCAA) or 30s (NFHS).',
    audioType: 'double',
  },
  {
    id: 'goal-scored',
    whistlePattern: '1 Long Loud Blast (📯———)',
    handSignal: 'Referee lowers arm toward center of pool',
    meaning: 'Goal Scored!',
    tableAction: 'Stop Clock -> Tap [+1 Goal] -> Shot clock resets to 30s & defending excluded player released.',
    audioType: 'long',
  },
  {
    id: 'corner-throw',
    whistlePattern: '1 Short Blast (📯)',
    handSignal: 'Referee points to 2-meter mark on goal line',
    meaning: 'Corner Throw (Deflected out by Goalie)',
    tableAction: 'Tap [20s RESET] in USAWP/NCAA/FINA (or [30s RESET] in NFHS High School).',
    audioType: 'short',
  },
  {
    id: 'penalty-foul',
    whistlePattern: '2 Long Blasts (📯——📯——)',
    handSignal: 'Referee raises 5 fingers in the air',
    meaning: '5-Meter Penalty Throw Awarded',
    tableAction: 'Stop Clock. If missed & rebounded by offense, tap [20s RESET] (or 30s in NFHS).',
    audioType: 'trill',
  },
];

export const SHOT_CLOCK_DECISION_MATRIX: ResetDecisionRule[] = [
  {
    situation: 'Change of Possession (Steal, Block out of bounds, Offensive Foul)',
    usawpNcaaFina: '30s',
    nfhsHighSchool: '30s',
    notes: 'Full 30-second possession clock whenever the other team gains the ball.',
  },
  {
    situation: 'Shot on Goal — Saved by Goalie or Hits Goalpost & Recovered by Offense',
    usawpNcaaFina: '20s',
    nfhsHighSchool: '30s',
    notes: 'Rule WP 20.16: Second offensive rebound opportunity gets 20s (30s in some NFHS states).',
  },
  {
    situation: 'Corner Throw (Ball deflected over endline by defending goalie)',
    usawpNcaaFina: '20s',
    nfhsHighSchool: '30s',
    notes: 'Attacking team retains possession from the 2m corner mark with 20s.',
  },
  {
    situation: 'Exclusion Foul Called on Defending Player (with >20s on Shot Clock)',
    usawpNcaaFina: 'No Reset',
    nfhsHighSchool: 'No Reset',
    notes: 'Never reduce an offensive team’s remaining shot clock if they already have >20s!',
  },
  {
    situation: 'Exclusion Foul Called on Defending Player (with <20s on Shot Clock)',
    usawpNcaaFina: '20s',
    nfhsHighSchool: '30s',
    notes: 'Shot clock resets up to 20s so the power-play has full 20 seconds to attack.',
  },
  {
    situation: 'Ordinary Foul (Free Throw at 6m) or Ball Deflected Out of Sideline',
    usawpNcaaFina: 'No Reset',
    nfhsHighSchool: 'No Reset',
    notes: 'Do NOT reset the shot clock on ordinary fouls or sideline out-of-bounds!',
  },
];

export const TRAINING_SCENARIOS: TrainingScenario[] = [
  {
    id: 'scen-1',
    title: 'Scenario 1: Shot Hits Goalpost & Offense Rebounds',
    gameTimeDisplay: '5:12',
    shotTimeDisplay: ':06',
    ruleset: 'USAWP / NCAA (30s & 20s)',
    refereeSignal: 'No whistle — Live ball rebounds off the crossbar back to White #4',
    description: 'White #4 shoots with 6 seconds left on the shot clock. The ball clangs off the goalpost and White #7 grabs the rebound in front of the cage.',
    correctAction: 'RESET_20',
    explanation: 'Correct! Under World Aquatics / USAWP Rule WP 20.16, a shot that hits the post or is saved by the goalie and rebounded by the offense resets to 20 seconds.',
  },
  {
    id: 'scen-2',
    title: 'Scenario 2: Ordinary Foul Outside 6 Meters',
    gameTimeDisplay: '4:35',
    shotTimeDisplay: ':14',
    ruleset: 'USAWP / NCAA (30s & 20s)',
    refereeSignal: '1 Short Whistle — Referee points in White’s attacking direction',
    description: 'Dark defender holds White #5 at the 7-meter mark. The referee blows one short whistle and signals a free throw for White.',
    correctAction: 'HOLD_CLOCK',
    explanation: 'Correct! An ordinary foul does NOT reset the shot clock. Keep the shot clock at 14 seconds.',
  },
  {
    id: 'scen-3',
    title: 'Scenario 3: Clean Steal by Defending Team',
    gameTimeDisplay: '3:18',
    shotTimeDisplay: ':11',
    ruleset: 'USAWP / NCAA (30s & 20s)',
    refereeSignal: 'No whistle — Dark #3 intercepts the pass into center',
    description: 'White passes the ball into 2-meters, and Dark #3 swims in front and steals the ball cleanly, turning to swim up the pool.',
    correctAction: 'RESET_30',
    explanation: 'Correct! A clear change of possession gives the new attacking team a full 30-second shot clock.',
  },
  {
    id: 'scen-4',
    title: 'Scenario 4: Goalie Deflects Shot Over Endline (Corner Throw)',
    gameTimeDisplay: '2:40',
    shotTimeDisplay: ':04',
    ruleset: 'USAWP / NCAA (30s & 20s)',
    refereeSignal: '1 Short Whistle — Referee points to the 2-meter red cone on the goal line',
    description: 'White fires a perimeter shot. The Dark goalkeeper tips the ball over the crossbar out of bounds. Referee signals a Corner Throw for White.',
    correctAction: 'RESET_20',
    explanation: 'Correct! A corner throw awarded to the attacking team resets the shot clock to 20 seconds in USAWP/NCAA/FINA.',
  },
  {
    id: 'scen-5',
    title: 'Scenario 5: Exclusion Called with 8 Seconds on Shot Clock',
    gameTimeDisplay: '6:05',
    shotTimeDisplay: ':08',
    ruleset: 'USAWP / NCAA (30s & 20s)',
    refereeSignal: '2 Short + 1 Long Whistle — Referee points to Dark #6 and sweeps to penalty corner',
    description: 'With 8 seconds left on White’s shot clock, Dark #6 commits an exclusion foul at center. Referee signals a 20-second exclusion.',
    correctAction: 'RESET_20',
    explanation: 'Correct! Because the shot clock (:08) was below 20 seconds when the exclusion occurred, it resets up to 20 seconds to match the 20s exclusion penalty.',
  },
  {
    id: 'scen-6',
    title: 'Scenario 6: Shot Blocked Out of Sideline by Field Defender',
    gameTimeDisplay: '1:50',
    shotTimeDisplay: ':09',
    ruleset: 'USAWP / NCAA (30s & 20s)',
    refereeSignal: '1 Short Whistle — Referee points for White ball on the sideline',
    description: 'White shoots, and a Dark field player blocks the ball so it bounces out of bounds over the sideline (not the goal line). White retains possession.',
    correctAction: 'HOLD_CLOCK',
    explanation: 'Correct! A ball blocked out the sideline by a field defender is NOT a corner throw and does NOT reset the shot clock. Keep the clock at :09.',
  },
];

export class VolunteerTrainingManager {
  public getWhistleSignals(): WhistleSignalSpec[] {
    return REFEREE_WHISTLE_SIGNALS;
  }

  public getDecisionMatrix(): ResetDecisionRule[] {
    return SHOT_CLOCK_DECISION_MATRIX;
  }

  public getScenarios(): TrainingScenario[] {
    return TRAINING_SCENARIOS;
  }
}

export const volunteerTrainingManager = new VolunteerTrainingManager();
