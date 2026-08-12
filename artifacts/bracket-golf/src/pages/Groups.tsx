import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetGroups, useCreateGroup, useJoinGroup } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Users, Plus, KeyRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Groups() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: groups, isLoading } = useGetGroups();
  
  const createGroupMutation = useCreateGroup();
  const joinGroupMutation = useJoinGroup();

  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    
    createGroupMutation.mutate(
      { data: { name: createName.trim(), description: createDesc.trim() } },
      {
        onSuccess: (newGroup) => {
          toast({ title: "Group created successfully!" });
          queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
          setLocation(`/groups/${newGroup.id}`);
        },
        onError: () => {
          toast({ title: "Failed to create group", variant: "destructive" });
        }
      }
    );
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    
    joinGroupMutation.mutate(
      { data: { joinCode: joinCode.trim() } },
      {
        onSuccess: (joinedGroup) => {
          toast({ title: "Joined group successfully!" });
          queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
          setLocation(`/groups/${joinedGroup.id}`);
        },
        onError: (err: any) => {
          toast({ 
            title: "Failed to join group", 
            description: err.message || "Invalid code or already a member.",
            variant: "destructive" 
          });
        }
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2">My Groups</h1>
          <p className="text-muted-foreground">Compete directly against your friends, family, or club.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Groups List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold font-heading">Active Groups</h2>
          
          {isLoading ? (
            <Card className="animate-pulse h-32 bg-gray-50" />
          ) : groups && groups.length > 0 ? (
            <div className="space-y-3">
              {groups.map((group) => (
                <Link key={group.id} href={`/groups/${group.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary group">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold font-heading text-lg group-hover:text-primary transition-colors">{group.name}</h3>
                        <p className="text-sm text-muted-foreground flex items-center mt-1">
                          <Users className="w-4 h-4 mr-1" />
                          {group.memberCount} members
                        </p>
                      </div>
                      <div className="bg-gray-100 px-3 py-1 rounded text-xs font-mono text-gray-600">
                        Code: {group.joinCode}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center text-muted-foreground border-dashed border-2">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>You haven't joined any groups yet.</p>
              <p className="text-sm mt-2">Create one or use a join code to get started.</p>
            </Card>
          )}
        </div>

        {/* Create/Join Forms */}
        <Card className="shadow-lg border-t-4 border-t-secondary">
          <Tabs defaultValue="join" className="w-full">
            <div className="p-1 border-b bg-gray-50">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="join">Join Group</TabsTrigger>
                <TabsTrigger value="create">Create Group</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="join" className="p-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="flex items-center text-xl">
                  <KeyRound className="w-5 h-5 mr-2 text-primary" /> Join with Code
                </CardTitle>
                <CardDescription>Enter the 6-character code provided by the group creator.</CardDescription>
              </CardHeader>
              <form onSubmit={handleJoin} className="space-y-4">
                <Input 
                  placeholder="e.g. A1B2C3" 
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="font-mono text-lg tracking-widest text-center uppercase"
                  maxLength={6}
                />
                <Button type="submit" className="w-full" disabled={joinGroupMutation.isPending || joinCode.length < 3}>
                  {joinGroupMutation.isPending ? "Joining..." : "Join Group"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="create" className="p-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="flex items-center text-xl">
                  <Plus className="w-5 h-5 mr-2 text-primary" /> Create New Group
                </CardTitle>
                <CardDescription>Start your own private leaderboard.</CardDescription>
              </CardHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Group Name</label>
                  <Input 
                    placeholder="e.g. Office Pool" 
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    maxLength={100}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-muted-foreground">Description (optional)</label>
                  <Input 
                    placeholder="Brief description..." 
                    value={createDesc}
                    onChange={(e) => setCreateDesc(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createGroupMutation.isPending || !createName.trim()}>
                  {createGroupMutation.isPending ? "Creating..." : "Create Group"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
