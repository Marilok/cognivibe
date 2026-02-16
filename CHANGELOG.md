# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.6] - 2026-02-16

### Added
- Pomodoro section on dashboard with focus streak display and start button
- PomodoroStartModal and PomodoroNextModal for starting and transitioning between focus sessions
- PomodoroContext and usePomodoroStreak hook for streak tracking
- Settings as dedicated window (openSettingsWindow) instead of modal

### Changed
- BreakManager and NotificationBar enhanced for improved Pomodoro integration
- Dashboard components refactored with updated button styles
- Survey sliders updated per style guide; deprecated components removed

### Removed
- Debug buttons for break and focus nudges from dashboard

## [1.1.5] - 2026-02-10

### Changed
- Version bump

## [1.1.4] - 2026-02-08

### Added
- Break nudge system: gentle break suggestions triggered by long sessions (90+ minutes) or high cognitive load (70+ score)
- Break warning popup: countdown window with "Start now", "+1 min", and "Skip" options before break overlay
- Break overlay: fullscreen glassmorphism overlay with blurred screenshot background, timer, and end-of-break survey
- Focus nudge system: context switching detection with focus session suggestions when switching exceeds personal baseline
- Focus nudge popup: notification-style popup suggesting focus sessions when excessive context switching is detected
- Focus timer: visual timer widget displayed in top-right corner and macOS menu bar during focus sessions
- Intelligent break pausing: breaks automatically pause during meetings, media consumption, or inactive periods
- System notifications: break and focus nudges trigger system notifications visible over fullscreen apps

### Changed
- Window management: improved window closing logic to handle duplicate windows and ensure proper cleanup
- Break overlay styling: enhanced glassmorphism effects with improved blur and transparency
- Focus timer display: shows remaining time in macOS menu bar tray icon

### Fixed
- Window closing issues: fixed stuck windows by ensuring all duplicate windows are destroyed
- Break overlay session end: improved session end logic to handle edge cases with missing session IDs
- Focus timer persistence: fixed timer remaining in tray after session cancellation

## [1.1.3] - 2026-02-07

### Added
- Display score transformation: read-time trend smoothing (R²-weighted sliding regression) and percentile-based remapping so the chart uses more of the 0–100 range
- User score percentiles (p10, p90, number_scores) from Supabase, computed every 12 hours; remapping blends in with confidence as data accumulates
- Display categories: low/mid/high thresholds set to 30/65 (tuned for remapped scores)

### Changed
- Chart and session bar colors now use 30/65 breakpoints; tooltip and circle card thresholds updated to match
- Tamed display amplification: target remap range 25–75 (was 15–85), blend strength 0.80 (was 0.65) to reduce wild swings while keeping trend emphasis

## [1.1.2] - 2026-02-01

### Added
- Extreme Z-score detection card on dashboard: when a behavioral metric hits |Z| ≥ 2.5, a top card appears with dynamic text ("Your [metric] is [direction].") and opens a quick check-in survey
- ZScoreSurveyModal: 3-question survey (focused, stressed, productive, 0–100) for extreme Z-score events; responses stored in cognitive_scores
- Server-side extreme Z-score detection in scoring utils with metric name mapping and direction labels
- PATCH `/api/scores/[id]/survey` endpoint to save Z-score survey responses (focused, stressed, productive)
- Scores API now returns `cognitive_score_id` and optional `extreme_zscore` when |Z| ≥ 2.5
- Rust: ExtremeZScoreAlert state, get/clear Tauri commands, and `extreme-zscore-alert` event
- Rust: Check for extreme Z-score on 5-minute boundaries after upload; 30% chance push notification when alert triggers
- Session notifications: 30% chance at 30-minute session mark; 70% chance when session ≥ 20 min and 4 consecutive inactive minutes
- Frontend: useExtremeZScoreAlert hook (polls + event listener), notifications utility, zscoreSurveyApi

### Changed
- WelcomeTourCard: shows tour card only when `opened_tutorial` is false; when tutorial is done, shows extreme Z-score card when an alert exists
- Minute logger: calls extreme Z-score check and session notification checks after successful uploads

### Fixed
- Rust E0597 in check_extreme_zscore: semicolon after if-let so MutexGuard is dropped before state
- ZScoreSurveyModal imports: use relative paths (../../utils, ../../hooks) instead of @ alias

## [1.1.1] - 2026-01-29

### Changed
- GradientCard component layout and session management refinements
- QuestionnaireModal styling and behavior updates

### Fixed
- Minor UI and component cleanup

## [1.1.0] - 2026-01-28

### Added
- Session data visualization to CognitiveLoadChart component
- ProductivityTimeCard component for tracking productivity metrics
- GradientCard component with dynamic session management and responsive views
- SessionStatsCard integration into dashboard layout
- QuestionnaireModal color scheme updates
- Session API GET endpoint for fetching sessions by date range
- Productivity time API endpoint for retrieving behavioral metrics
- Survey score handling in session end API endpoint
- Enhanced logging and error handling across components and APIs

### Changed
- Refactored ProductivityTimeCard and QuestionnaireModal components
- Enhanced GradientCard layout to include SessionStatsCard with improved responsiveness
- Improved CognitiveLoadChart and SessionBars with detailed logging for debugging
- Updated scoring calculations to use window_change_count instead of app_switch_count for improved accuracy in pressure score metrics
- Refactored HelpButton component and updated usage in dashboard cards
- Enhanced Tauri commands for improved development workflow
- Updated package versions across dependencies

### Fixed
- Improved error handling and debugging capabilities across the application
- Enhanced API type safety and validation

## [1.0.10] - 2026-01-27

### Changed
- Release build preparation

## [1.0.9] - 2026-01-16

### Added
- Accessible aria-labels to date picker and navigation buttons
- Runtime environment variable support for API base URL (VITE_SERVER_URL)

### Changed
- Dashboard layout: right metric cards now align with cognitive load chart height
- Chart display: removed dense vertical grid lines and empty data points for cleaner visualization
- Help button descriptions now properly display in metric card tooltips

### Fixed
- JSX syntax error in DashboardPage
- Placeholder metric cards now include descriptions for accessibility
- Chart x-axis now starts at first data point instead of including synthetic missing intervals
- Accessibility warnings for unlabeled form inputs

## [1.0.8] - 2026-01-04

### Added
- DashboardContext for managing selected date state
- Batch scores API utility for fetching batch scores from server
- Global listener for session data requests
- tauri-plugin-prevent-default to prevent context menu and shortcuts
- MIT License

### Changed
- Updated useDashboardData to fetch data based on selected date
- Enhanced useAuth to send session data to backend on authentication changes
- Active window logging now runs asynchronously for improved input handling

### Fixed
- Context menu behavior now properly prevented
- Improved input handling performance

### Removed
- WeeklyAssessmentModal and related imports
- Unused Supabase configuration files and directories
- created_at field from relevant components

## [1.0.7] - 2025-08-10

### Added
- Support for uploading debug builds with retention policy
- Enhanced CI/CD workflow for debug build management

### Fixed
- Overflow handling in UI components
- Sticky navbar positioning and behavior
- Non-selectable text issues
- Smooth scroll functionality improvements

## [1.0.6] - 2025-08-09

### Added
- Enhanced input tracking system with new callback functions for button press/release, key press/release, mouse move, and wheel events
- New `get_is_measuring` function for better measurement state management
- Active window logging functionality with comprehensive window tracking
- Improved global input tracker with more robust event handling
- Enhanced minute logger with better tracking capabilities
- New tracker types and state management improvements
- macOS permissions handling improvements

### Changed
- Refactored input callback system with modular approach
- Enhanced start_global_input_tracker functionality
- Improved tracker module organization and structure
- Updated wavy background component
- Enhanced API configuration
- Updated constants and utility functions

### Fixed
- Removed deprecated color utilities
- Improved module organization and dependencies

## [1.0.5] - 2025-08-07

### Added
- Custom scrollbar styles for improved UI consistency
- New WideCircleChartCard component for metrics display
- Enhanced input tracking with new state management and measurement logic
- Color utilities for consistent logging across modules
- CircleChartCard component integration into DashboardPage

### Changed
- Updated multiple dependencies to latest versions:
  - @heroui/react from 2.8.0-beta.7 to 2.8.2
  - @heroui/theme from 2.4.17 to 2.4.20
  - framer-motion from 12.18.1 to 12.23.12
  - react from 19.1.0 to 19.1.1
  - react-dom from 19.1.0 to 19.1.1
  - tailwindcss from 4.1.10 to 4.1.11
- Enhanced UI with updated color themes
- Improved HelpButton component to accept className prop
- Redesigned current load card component
- Updated settings properties for clarity and consistency

### Fixed
- Removed displayName assignment from ActionCard component
- Cleaned up whitespace in run and focus_main_window functions
- Removed unused ModalFooter import from UserProfileModal
- General code formatting and comment cleanup

### Removed
- Redundant files cleanup
- Removed unnecessary stats card components
- Removed unnecessary logging statements

## [1.0.4] - 2025-07-31

### Added
- macOS permissions handling system with dedicated React hook
- Enhanced external URL handling with proper browser opening
- Brain icon fallback for user avatars
- New macOS-specific permission requests and status checking

### Fixed
- Function name corrections for URL opening functionality
- Proper external URL handling in default browser
- Updated Tauri plugin dependencies to latest versions
- Corrected rdev dependency to use rustdesk GitHub repository

### Changed
- Comprehensive code formatting across all Rust modules
- Moved functions into organized module structure
- Removed unused OAuth login buttons
- Cleanup of unused settings and measuring state commands
- Updated API configuration for user deletion functionality
- Changed UI dropdown components to modal implementations
- Enhanced macOS entitlements for better permission handling

### Dependencies
- Updated multiple Tauri plugins to latest versions
- Updated rdev dependency for better macOS compatibility
- Added new npm packages for macOS permissions handling

## [1.0.3] - 2025-07-25

### Added
- macOS code signing and notarization support
- Automatic certificate management in CI/CD pipeline
- Enhanced security for macOS app distribution

### Fixed
- Removed duplicate notarization process (now handled automatically by Tauri)
- Improved macOS build reliability with proper certificate verification

### Changed
- Updated GitHub Actions workflow for streamlined macOS signing
- Enhanced macOS distribution process for better user experience

## [1.0.2] - 2025-07-22

### Added
- Comprehensive macOS entitlements for full app functionality
- Input monitoring permissions for global input tracking
- System information access for performance monitoring
- Network client permissions for Supabase communication

### Fixed
- Bundle identifier changed from `com.cognivibe.app` to `com.cognivibe.desktop`
- Resolved macOS bundle extension conflicts
- Enhanced security posture with minimal required entitlements

### Changed
- Improved macOS compatibility and permission handling
- Streamlined entitlements for better security and functionality
- Updated app identifier for better platform compliance

## [1.0.1] - 2025-07-22

### Added
- Auto-updater modal with progress tracking
- Download progress visualization
- Automatic app restart after updates

### Fixed
- macOS M1 compatibility issues with input tracking
- TypeScript type safety for updater components
- Platform-specific build optimizations

### Changed
- Improved update notification user experience
- Enhanced error handling for update process
- Non-dismissible update modal for critical updates

## [1.0.0] - 2025-07-17

### Added
- Initial release of Cognivibe
- Cognitive performance measurement and tracking
- Dashboard with cognitive load charts
- Weekly assessment functionality
- User authentication and data persistence
- Dark theme interface
- Cross-platform support (Windows, macOS Intel, macOS ARM)
- Auto-updater functionality
- Deep linking support

### Features
- **Dashboard**: Real-time cognitive load monitoring and visualization
- **Assessments**: Weekly cognitive performance assessments
- **Data Visualization**: Charts and graphs to track progress over time
- **Settings**: Customizable app preferences and configurations
- **Authentication**: Secure user login and data synchronization
- **Responsive Design**: Modern, dark-themed interface
- **Cross-Platform**: Native desktop applications for Windows and macOS
- **Auto-Updates**: Automatic app updates through built-in updater
- **Deep Links**: Support for custom URL schemes (cognivibe://)

### Technical
- Built with Tauri 2.x for native performance
- React 19 frontend with TypeScript
- Supabase backend integration
- Vite build system
- Tailwind CSS for styling
- Recharts for data visualization
- Framer Motion for animations
