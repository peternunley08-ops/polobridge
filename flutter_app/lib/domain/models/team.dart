/// Water Polo team designation (White or Dark caps).
enum Team {
  white,
  dark;

  String get displayName {
    switch (this) {
      case Team.white:
        return 'White';
      case Team.dark:
        return 'Dark';
    }
  }

  Team get opposite => this == Team.white ? Team.dark : Team.white;
}
