import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Avatar,
  useDisclosure,
} from "@heroui/react";
import logotypeSvg from "../../assets/logotype.svg";
import { useAuth, useUserData } from "../../hooks";
import MeasureButton from "./MeasureButton";
import {
  HelpModal,
  LogoutModal,
  UserProfileModal,
} from "../modals";
import { openSettingsWindow } from "../../utils/openSettingsWindow";
import { IconUser } from "@tabler/icons-react";

interface AppNavbarProps {
  // No props needed - component manages its own modal states
}

const AppNavbar: React.FC<AppNavbarProps> = () => {
  const { session } = useAuth();
  const { userData } = useUserData(session?.user?.id);

  // Modal states managed within the component
  const {
    isOpen: isHelpOpen,
    onOpen: onHelpOpen,
    onOpenChange: onHelpOpenChange,
  } = useDisclosure();
  const {
    isOpen: isLogoutOpen,
    onOpen: onLogoutOpen,
    onOpenChange: onLogoutOpenChange,
  } = useDisclosure();
  const {
    isOpen: isProfileOpen,
    onOpen: onProfileOpen,
    onOpenChange: onProfileOpenChange,
  } = useDisclosure();

  const avatarSrc = userData?.avatar_url || undefined;

  return (
    <Navbar className="py-4 sticky top-0 z-40">
      <NavbarBrand>
        <img
          src={logotypeSvg}
          alt="CogniVibe Logo"
          className="object-contain h-12 "
        />
      </NavbarBrand>
      <NavbarContent className="hidden sm:flex gap-4" justify="center">
        <NavbarItem>
          <MeasureButton />
        </NavbarItem>
      </NavbarContent>
      <NavbarContent as="div" justify="end">
        <Avatar
          as="button"
          className="transition-transform cursor-pointer hover:scale-105 select-none"
          color="primary"
          size="sm"
          src={avatarSrc}
          fallback={<IconUser size={20} />}
          onClick={onProfileOpen}
        />
      </NavbarContent>
      <UserProfileModal
        isOpen={isProfileOpen}
        onOpenChange={onProfileOpenChange}
        onSettingsOpen={openSettingsWindow}
        onHelpOpen={onHelpOpen}
        onLogoutOpen={onLogoutOpen}
      />
      <HelpModal isOpen={isHelpOpen} onOpenChange={onHelpOpenChange} />
      <LogoutModal isOpen={isLogoutOpen} onOpenChange={onLogoutOpenChange} />
    </Navbar>
  );
};

export default AppNavbar;
