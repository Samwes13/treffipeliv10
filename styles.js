import { StyleSheet, Dimensions } from 'react-native';

// Responsive size helpers
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// Make logo visibly larger on most screens
const HEADER_LOGO_HEIGHT = Math.round(Math.max(200, Math.min(360, SCREEN_HEIGHT * 0.32))); // ~32% of height
const LOGO_SPACE_LARGE = Math.round(HEADER_LOGO_HEIGHT * 0.8);  // maintain clearance for bigger logo
const LOGO_SPACE_MED = Math.round(HEADER_LOGO_HEIGHT * 0.6);    // (~60% of header)
const LOGO_SPACE_SMALL = Math.round(HEADER_LOGO_HEIGHT * 0.45);   // (~45% of header)

const styles = StyleSheet.create({
  // Base container for screens with gradient background
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },

  // Full-screen background helper (for LinearGradient)
  background: {
    ...StyleSheet.absoluteFillObject,
  },

  // Typography
  subtitle: {
    fontSize: 35,
    color: 'white',
    fontWeight: 'bold',
    paddingBottom: 5,
  },
  title: {
    fontSize: 30,
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    width: '80%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#FE9091',
    borderRadius: 25,
    marginBottom: 20,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#000',
  },

  // Buttons
  button: {
    backgroundColor: '#ff8fd9',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginBottom: 20,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  disabledButton: {
    backgroundColor: 'gray',
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },

  // Icons and modal common
  helpIcon: {
    position: 'absolute',
    top: '10%',
    right: '8%',
    tintColor: 'white',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '95%',
    height: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    paddingTop: '13%',
  },
  closeButton: {
    marginTop: '5%',
    marginBottom: '5%',
    backgroundColor: '#d9534f',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },

  // Logo helpers
  logo: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: '100%',
    height: HEADER_LOGO_HEIGHT,
    resizeMode: 'contain',
  },
  logoSpaceLarge: {
    height: LOGO_SPACE_LARGE,
    width: '100%',
  },
  logoSpaceMedium: {
    height: LOGO_SPACE_MED,
    width: '100%',
  },
  logoSpaceSmall: {
    height: LOGO_SPACE_SMALL,
    width: '100%',
  },

  // Content padding helpers to clear the absolute-positioned logo
  padBelowLogoLarge: {
    // Ensure content starts clearly below the absolute-positioned logo
    paddingTop: HEADER_LOGO_HEIGHT + 24,
  },
  padBelowLogoMedium: {
    paddingTop: LOGO_SPACE_MED,
  },
  padBelowLogoSmall: {
    paddingTop: LOGO_SPACE_SMALL,
  },

  // Lists and items
  playerGrid: {
    paddingHorizontal: 12,
    paddingBottom: 160,
  },
  playerRow: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  playerList: {
    width: '100%',
  },
  playerItem: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginHorizontal: 6,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  playerRemove: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F65151',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  playerRemoveText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 18,
  },
  playerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    backgroundColor: '#f5f5f5',
    borderColor: '#E5E7EB',
  },
  playerAvatarReady: {
    backgroundColor: '#ecfdf3',
    borderColor: '#80C938',
  },
  playerAvatarWaiting: {
    backgroundColor: '#f0eaff',
    borderColor: '#906AFE',
  },
  playerAvatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2c1b4a',
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 10,
    textAlign: 'center',
  },
  playerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 6,
  },
  playerStatusReady: {
    backgroundColor: 'rgba(128, 201, 56, 0.18)',
  },
  playerStatusWaiting: {
    backgroundColor: 'rgba(144, 106, 254, 0.18)',
  },
  playerStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  playerStatusTextReady: {
    color: '#2f855a',
  },
  playerStatusTextWaiting: {
    color: '#5030d6',
  },
  playerStatusSpinner: {
    marginLeft: 6,
  },
  playerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  playerTextPlay: {
    fontSize: 18,
    color: '#FFFFFF',
    marginVertical: 5,
    textAlign: 'center',
    marginBottom: 15,
  },

  roundText: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 20,
  },
  traitText: {
    fontWeight: 'bold',
    fontSize: 32,
    color: '#ff66c4',
    marginBottom: 15,
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
    padding: 19,
    borderRadius: 14,
  },
  newtraitText: {
    fontWeight: 'bold',
    fontSize: 32,
    color: '#FFFFFF',
    marginBottom: 15,
    textAlign: 'center',
  },
  playerAcceptedTraitset: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 5,
  },

  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonYes: {
    backgroundColor: '#80C938',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    marginRight: 20,
  },
  buttonNo: {
    backgroundColor: '#F65151',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  removeButton: {
    color: 'red',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  removeButtonText: {
    color: 'red',
    fontWeight: 'bold',
  },

  // Back button (JoinGame)
  backButton: {
    position: 'absolute',
    left: 20,
    bottom: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },

  // Gameplay overlays
  animatedContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    pointerEvents: 'none',
    backgroundColor: '#906AFE',
  },
  animationContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
    pointerEvents: 'none',
  },
  animatedText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  animationText: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // GameOptions top row
  helpIconCentered: {
    marginTop: 12,
    alignItems: 'center',
    width: '100%',
  },
  helpIconTopRight: {
    position: 'absolute',
    top: 24,
    right: 16,
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    marginBottom: 6,
    gap: 12,
    zIndex: 2,
  },
  topRowAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  logoInline: {
    position: 'relative',
    width: 360,
    height: 140,
    resizeMode: 'contain',
    marginRight: 8,
  },
  // New header layout for GameOptions: big centered logo + pinned icons
  headerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogo: {
    width: '70%',
    height: 130,
    resizeMode: 'contain',
    alignSelf: 'center',
  },
  headerIconLeft: {
    position: 'absolute',
    top: 10,
    left: 16,
  },
  headerIconRight: {
    position: 'absolute',
    top: 10,
    right: 16,
  },
  headerSpacer: {
    height: 200,
    width: '100%',
  },
  headerIconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  helpIconInline: {
    padding: 8,
  },

  debugBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  debugPanel: {
    width: '92%',
    maxWidth: 720,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  debugTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    textAlign: 'center',
  },
  debugSubtitle: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
  },
  debugScroll: {
    width: '100%',
  },
  debugGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  debugCard: {
    width: '48%',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  debugCardActive: {
    borderWidth: 2,
    borderColor: '#5170ff',
  },
  debugCardDone: {
    borderWidth: 2,
    borderColor: '#22c55e',
    backgroundColor: '#ECFDF3',
  },
  debugCardError: {
    borderWidth: 2,
    borderColor: '#ef4444',
    backgroundColor: '#FEE2E2',
  },
  debugCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  debugCardStatus: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  debugCardDetail: {
    fontSize: 13,
    color: '#4b5563',
  },
  debugError: {
    marginTop: 12,
    color: '#ef4444',
    fontWeight: '600',
    textAlign: 'center',
  },

  // Extra modal styles used in GameLobby
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalText: {
    color: '#333',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  modalButton: {
    backgroundColor: '#5170ff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default styles;




