import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { authClient } from "~/lib/auth-client";

export function SignOutButton() {
  const navigate = useNavigate();
  return (
    <Button
      type="button"
      variant="destructive"
      size="small"
      onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => navigate("/auth/login") } })}
    >
      Sign out
    </Button>
  );
}
