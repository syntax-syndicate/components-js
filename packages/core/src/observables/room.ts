import { merge, Observable } from 'zen-observable/esm';
import { Participant, Room, RoomEvent, Track, TrackPublication } from 'livekit-client';
import { RoomEventCallbacks } from 'livekit-client/dist/src/room/Room';
import { observableWithDefault } from './utils';
export function observeRoomEvents(room: Room, ...events: RoomEvent[]): Observable<Room> {
  const observable = Observable.of(room).concat(
    new Observable<Room>((subscribe) => {
      const onRoomUpdate = () => {
        subscribe.next(room);
      };

      events.forEach((evt) => {
        room.on(evt, onRoomUpdate);
      });

      const unsubscribe = () => {
        events.forEach((evt) => {
          room.off(evt, onRoomUpdate);
        });
      };
      return unsubscribe;
    }),
  );

  return observable;
}

export function roomEventSelector<T extends RoomEvent>(room: Room, event: T) {
  const observable = new Observable<Parameters<RoomEventCallbacks[T]>>((subscribe) => {
    type Callback = RoomEventCallbacks[T];
    const update: Callback = (...params: Array<any>) => {
      // @ts-ignore
      subscribe.next(params);
    };
    room.on(event, update);

    const unsubscribe = () => {
      room.off(event, update);
    };
    return unsubscribe;
  });

  return observable;
}

export function roomObserver(room: Room) {
  const observable = observableWithDefault(
    observeRoomEvents(
      room,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.ActiveSpeakersChanged,
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
      RoomEvent.AudioPlaybackStatusChanged,
      RoomEvent.ConnectionStateChanged,
    ),
    room,
  );

  return observable;
}

export function allRoomEvents(room: Room) {
  return merge(
    roomEventSelector(room, RoomEvent.ActiveSpeakersChanged),
    roomEventSelector(room, RoomEvent.ConnectionStateChanged),
    roomEventSelector(room, RoomEvent.ConnectionStateChanged),
    roomEventSelector(room, RoomEvent.ConnectionStateChanged),
    roomEventSelector(room, RoomEvent.ConnectionStateChanged),
    roomEventSelector(room, RoomEvent.ConnectionStateChanged),
    roomEventSelector(room, RoomEvent.ConnectionStateChanged),
    roomEventSelector(room, RoomEvent.ConnectionStateChanged),
  );
}

export function connectionStateObserver(room: Room) {
  return observableWithDefault(
    roomEventSelector(room, RoomEvent.ConnectionStateChanged).map(
      ([connectionState]) => connectionState,
    ),
    room.state,
  );
}
export type ScreenShareTrackMap = Array<{
  participant: Participant;
  tracks: Array<TrackPublication>;
}>;

export function screenShareObserver(room: Room) {
  let screenShareSubscriber: ZenObservable.SubscriptionObserver<ScreenShareTrackMap>;
  const observers: ZenObservable.Subscription[] = [];

  const observable = new Observable<ScreenShareTrackMap>((subscriber) => {
    screenShareSubscriber = subscriber;
    return () => {
      observers.forEach((observer) => {
        observer.unsubscribe();
      });
    };
  });
  const screenShareTracks: ScreenShareTrackMap = [];

  const handleSub = (publication: TrackPublication, participant: Participant) => {
    if (
      publication.source !== Track.Source.ScreenShare &&
      publication.source !== Track.Source.ScreenShareAudio
    ) {
      return;
    }
    let trackMap = screenShareTracks.find((tr) => tr.participant.identity === participant.identity);
    const getScreenShareTracks = (participant: Participant) => {
      return participant
        .getTracks()
        .filter(
          (track) =>
            (track.source === Track.Source.ScreenShare ||
              track.source === Track.Source.ScreenShareAudio) &&
            track.track,
        );
    };
    if (!trackMap) {
      trackMap = {
        participant,
        tracks: getScreenShareTracks(participant),
      };
    } else {
      const index = screenShareTracks.indexOf(trackMap);
      screenShareTracks.splice(index, 1);
      trackMap.tracks = getScreenShareTracks(participant);
    }
    if (trackMap.tracks.length > 0) {
      screenShareTracks.push(trackMap);
    }

    screenShareSubscriber.next(screenShareTracks);
  };
  observers.push(
    roomEventSelector(room, RoomEvent.TrackSubscribed).subscribe(([, ...args]) =>
      handleSub(...args),
    ),
  );
  observers.push(
    roomEventSelector(room, RoomEvent.TrackUnsubscribed).subscribe(([, ...args]) =>
      handleSub(...args),
    ),
  );
  observers.push(
    roomEventSelector(room, RoomEvent.LocalTrackPublished).subscribe((args) => handleSub(...args)),
  );
  observers.push(
    roomEventSelector(room, RoomEvent.LocalTrackUnpublished).subscribe((args) => {
      handleSub(...args);
    }),
  );
  observers.push(
    roomEventSelector(room, RoomEvent.TrackMuted).subscribe((args) => {
      handleSub(...args);
    }),
  );
  observers.push(
    roomEventSelector(room, RoomEvent.TrackUnmuted).subscribe((args) => {
      handleSub(...args);
    }),
  );
  setTimeout(() => {
    // TODO find way to avoid this timeout
    for (const p of room.participants.values()) {
      p.getTracks().forEach((track) => {
        handleSub(track, p);
      });
    }
  }, 1);

  return observable;
}

export function roomInfoObserver(room: Room) {
  const observer = observeRoomEvents(
    room,
    RoomEvent.RoomMetadataChanged,
    RoomEvent.ConnectionStateChanged,
  ).map((r) => {
    return { name: r.name, metadata: r.metadata };
  });
  return observer;
}

export function activeSpeakerObserver(room: Room) {
  return roomEventSelector(room, RoomEvent.ActiveSpeakersChanged).map(([speakers]) => speakers);
}

export function createMediaDeviceObserver(kind?: MediaDeviceKind, requestPermissions = true) {
  let deviceSubscriber: ZenObservable.SubscriptionObserver<MediaDeviceInfo[]> | undefined;
  const onDeviceChange = async () => {
    const newDevices = await Room.getLocalDevices(kind, requestPermissions);
    deviceSubscriber?.next(newDevices);
  };
  const observable = new Observable<MediaDeviceInfo[]>((subscriber) => {
    deviceSubscriber = subscriber;
    navigator?.mediaDevices.addEventListener('devicechange', onDeviceChange);
    return () => navigator?.mediaDevices.removeEventListener('devicechange', onDeviceChange);
  });
  // because we rely on an async function, trigger the first update instead of using startWith
  if (typeof window !== 'undefined') {
    onDeviceChange();
  }
  return observable;
}

export function createDataObserver(room: Room) {
  return roomEventSelector(room, RoomEvent.DataReceived);
}
