import {
  BookOpen,
  Code2,
  Languages,
  ListCollapse,
  Mail,
  Megaphone,
  MessageSquare,
  PenLine,
  Repeat2,
  Shapes,
  type LucideIcon,
} from "lucide-react";
import type { ModeId } from "@/lib/types";

export const MODE_ICONS: Record<ModeId, LucideIcon> = {
  chat: MessageSquare,
  write: PenLine,
  rewrite: Repeat2,
  summarize: ListCollapse,
  translate: Languages,
  code: Code2,
  email: Mail,
  social: Megaphone,
  ideas: Shapes,
  explain: BookOpen,
};
