import { useState } from "react";
import { FolderPlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStudio } from "@/lib/store";
import { EngineShell } from "./engine-shell";

export function Projects() {
  const projects = useStudio((s) => s.projects);
  const conversations = useStudio((s) => s.conversations);
  const createProject = useStudio((s) => s.createProject);
  const renameProject = useStudio((s) => s.renameProject);
  const deleteProject = useStudio((s) => s.deleteProject);
  const assignProject = useStudio((s) => s.assignProject);

  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  function handleCreate() {
    if (!name.trim()) return;
    const id = createProject(name.trim());
    setName("");
    setOpenId(id);
    toast.success("Proyek dibuat.");
  }

  function handleRename(id: string) {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }
    renameProject(id, editingName.trim());
    setEditingId(null);
  }

  const openProject = projects.find((p) => p.id === openId) ?? null;
  const projectConversations = openProject
    ? conversations.filter((c) => c.projectId === openProject.id)
    : [];
  const unassigned = conversations.filter((c) => !c.projectId);

  return (
    <EngineShell
      kicker="Ruang Kerja"
      title="Proyek"
      subtitle="Kelompokkan percakapan ke dalam proyek."
    >
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
          placeholder="Nama proyek baru…"
          aria-label="Nama proyek baru"
        />
        <Button onClick={handleCreate} disabled={!name.trim()} className="gap-1.5">
          <FolderPlus className="size-4" /> Buat
        </Button>
      </div>

      {projects.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Belum ada proyek. Buat satu untuk mulai mengelompokkan percakapan.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {projects.map((project) => {
            const count = conversations.filter((c) => c.projectId === project.id).length;
            const open = openId === project.id;
            return (
              <li key={project.id} className="rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2 p-3">
                  {editingId === project.id ? (
                    <Input
                      value={editingName}
                      autoFocus
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(project.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onBlur={() => handleRename(project.id)}
                      className="h-8"
                      aria-label="Nama proyek"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : project.id)}
                      className="min-w-0 flex-1 truncate text-left text-sm font-medium"
                    >
                      {project.name}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {count} percakapan
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Ubah nama ${project.name}`}
                    onClick={() => {
                      setEditingId(project.id);
                      setEditingName(project.name);
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus ${project.name}`}
                    onClick={() => {
                      deleteProject(project.id);
                      if (openId === project.id) setOpenId(null);
                      toast.success("Proyek dihapus.");
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                {open && (
                  <div className="border-t border-border p-3">
                    {projectConversations.length === 0 && unassigned.length === 0 && (
                      <p className="text-xs text-muted-foreground">Belum ada percakapan.</p>
                    )}
                    {projectConversations.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 py-1">
                        <span className="min-w-0 flex-1 truncate text-xs">{c.title}</span>
                        <button
                          type="button"
                          onClick={() => assignProject(c.id, null)}
                          className="text-xs text-muted-foreground hover:text-red-500"
                        >
                          Keluarkan
                        </button>
                      </div>
                    ))}
                    {unassigned.length > 0 && (
                      <div className="mt-2 border-t border-border pt-2">
                        <p className="mb-1 text-[11px] tracking-wider text-muted-foreground uppercase">
                          Tanpa proyek
                        </p>
                        {unassigned.slice(0, 10).map((c) => (
                          <div key={c.id} className="flex items-center gap-2 py-1">
                            <span className="min-w-0 flex-1 truncate text-xs">{c.title}</span>
                            <button
                              type="button"
                              onClick={() => assignProject(c.id, project.id)}
                              className="text-xs text-primary hover:underline"
                            >
                              Masukkan
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </EngineShell>
  );
}
