import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { colors } from "../theme";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function NarrationPlayer({ url, label }: { url: string; label?: string }) {
  const player = useAudioPlayer(url, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const progress = status.duration ? Math.min(status.currentTime / status.duration, 1) : 0;

  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish) player.seekTo(0);
    player.play();
  };

  return (
    <HStack className="items-center gap-3 rounded-[16px] border border-border bg-elevated p-3.5">
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? "Pause narration" : "Play narration"}
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: colors.brick }}
      >
        <Ionicons name={status.playing ? "pause" : "play"} size={20} color={colors.white} />
      </Pressable>
      <VStack className="flex-1 gap-1.5">
        <Text className="text-[13px] font-semibold text-foreground">
          {label || "Listen to its story"}
        </Text>
        <Box className="h-1.5 overflow-hidden rounded-full bg-[#3B3230]">
          <Box className="h-full rounded-full bg-teal" style={{ width: `${Math.round(progress * 100)}%` }} />
        </Box>
        <Text className="text-[11px] leading-[15px] text-muted-foreground tabular-nums">
          {clock(status.currentTime)} / {clock(status.duration)}
        </Text>
      </VStack>
    </HStack>
  );
}
