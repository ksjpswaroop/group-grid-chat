import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

interface User {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface MentionAutocompleteProps {
  users: User[];
  onSelect: (user: User) => void;
  searchQuery: string;
}

export default function MentionAutocomplete({
  users,
  onSelect,
  searchQuery,
}: MentionAutocompleteProps) {
  const filteredUsers = users.filter((user) =>
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (filteredUsers.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 border rounded-lg shadow-lg bg-popover">
      <Command>
        <CommandList>
          <CommandEmpty>No users found</CommandEmpty>
          <CommandGroup heading="Channel Members">
            {filteredUsers.map((user) => (
              <CommandItem
                key={user.id}
                onSelect={() => onSelect(user)}
                className="cursor-pointer"
              >
                <Avatar className="h-6 w-6 mr-2">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials(user.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span>{user.full_name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
