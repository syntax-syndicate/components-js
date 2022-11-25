import {
  observeParticipantMedia,
  ParticipantMedia,
  setupManualToggle,
  setupMediaToggle,
} from '@livekit/components-core';
import { LocalParticipant, Track, TrackPublication } from 'livekit-client';
import * as React from 'react';
import { mergeProps } from '../../mergeProps';
import { useMaybeRoomContext, useRoomContext } from '../../contexts';
import { useObservableState } from '../../utils';

export type MediaControlProps = Omit<React.HTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  source: Track.Source;
  initialState?: boolean; // FIXME: initialState false has no effect.
  onChange?: (enabled: boolean) => void;
};

export const TrackSource = Track.Source;

export const useLocalParticipant = () => {
  const room = useRoomContext();
  const [localParticipant, setLocalParticipant] = React.useState(room.localParticipant);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = React.useState(
    localParticipant.isMicrophoneEnabled,
  );
  const [isCameraEnabled, setIsCameraEnabled] = React.useState(
    localParticipant.isMicrophoneEnabled,
  );
  const [isScreenShareEnabled, setIsScreenShareEnabled] = React.useState(
    localParticipant.isMicrophoneEnabled,
  );
  const [microphoneTrack, setMicrophoneTrack] = React.useState<TrackPublication | undefined>(
    undefined,
  );
  const [cameraTrack, setCameraTrack] = React.useState<TrackPublication | undefined>(undefined);

  const handleUpdate = (media: ParticipantMedia<LocalParticipant>) => {
    setIsCameraEnabled(media.isCameraEnabled);
    setIsMicrophoneEnabled(media.isMicrophoneEnabled);
    setIsScreenShareEnabled(media.isScreenShareEnabled);
    setCameraTrack(media.cameraTrack);
    setMicrophoneTrack(media.microphoneTrack);
    setLocalParticipant(media.participant);
  };
  React.useEffect(() => {
    const listener = observeParticipantMedia(localParticipant).subscribe(handleUpdate);
    return () => listener.unsubscribe();
  });
  return {
    isMicrophoneEnabled,
    isScreenShareEnabled,
    isCameraEnabled,
    microphoneTrack,
    cameraTrack,
    localParticipant,
  };
};

export const useMediaToggle = ({ source, onChange, initialState, ...rest }: MediaControlProps) => {
  const room = useMaybeRoomContext();
  const track = room?.localParticipant?.getTrack(source);

  const { toggle, className, pendingObserver, enabledObserver } = React.useMemo(
    () => (room ? setupMediaToggle(source, room) : setupManualToggle(!!initialState)),
    [room, source, initialState],
  );

  const pending = useObservableState(pendingObserver, false);
  const enabled = useObservableState(enabledObserver, !!track?.isEnabled);

  React.useEffect(() => {
    onChange?.(enabled);
  }, [enabled, onChange]);

  const newProps = React.useMemo(() => mergeProps(rest, { className }), [rest, className]);

  const clickHandler: React.MouseEventHandler<HTMLButtonElement> = React.useCallback(
    (evt) => {
      toggle();
      rest.onClick?.(evt);
    },
    [rest, toggle],
  );

  return {
    toggle,
    enabled,
    pending,
    track,
    buttonProps: {
      ...newProps,
      'aria-pressed': enabled,
      'data-lk-source': source,
      'data-lk-enabled': enabled,
      disabled: pending,
      onClick: clickHandler,
    },
  };
};

/**
 * With the MediaControlButton component it is possible to mute and unmute your camera and microphone.
 * The component uses an html button element under the hood so you can treat it like a button.
 *
 * @example
 * ```tsx
 * <LiveKitRoom>
 *   <MediaControlButton source={Track.Source.Microphone} />
 *   <MediaControlButton source={Track.Source.Camera} />
 * </LiveKitRoom>
 * ```
 */
export const MediaControlButton = (props: MediaControlProps) => {
  const { buttonProps } = useMediaToggle(props);
  return <button {...buttonProps}>{props.children}</button>;
};
