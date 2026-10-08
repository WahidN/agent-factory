## Purpose

Going inside your own head office, and what you see there: a floor with one desk per session you run, and a robot behind every desk that works while its session works. It is the close-up view of the city, for the sessions that are yours.

## ADDED Requirements

### Requirement: Only your own HQ opens
The page SHALL treat as its own the user the server names when it connects, and no other. A server that serves one machine's own sessions SHALL name that machine's user. A central SHALL name no user, and a page that is told no user SHALL offer no way into any building.

Clicking the HQ of that user SHALL open a card that names whose office it is, how many agents are inside, and offers a way in. Clicking another user's HQ, a lot, or the ground SHALL NOT open the card. A drag that rotates or pans the camera SHALL NOT count as a click. Clicking outside the card, pressing Escape, or going in SHALL close it.

An open card SHALL NOT stop a building from answering the pointer, so hovering keeps working while it is on screen.

#### Scenario: Local server
- **WHEN** the page is served by a server that runs its own machine's sessions as user `wahid`, and that HQ is clicked
- **THEN** a card names `wahid`, how many agents are inside, and offers to go in

#### Scenario: Central
- **WHEN** the page is served by a central and any HQ is clicked
- **THEN** no card opens and no building can be entered

#### Scenario: Someone else's HQ
- **WHEN** the page belongs to `wahid` and the HQ of `noor` is clicked
- **THEN** no card opens

#### Scenario: A lot is clicked
- **WHEN** a hall, a warehouse or the ground is clicked
- **THEN** no card opens

#### Scenario: Dragging the camera
- **WHEN** a drag that rotates or pans the view starts on your own HQ and ends there
- **THEN** no card opens

#### Scenario: Card dismissed
- **WHEN** the card is open and Escape is pressed, or a click lands outside it
- **THEN** the card closes and the city is unchanged

#### Scenario: Showcase
- **WHEN** the page is opened with `?mode=showcase`
- **THEN** one fixed showcase user counts as your own and that HQ can be entered

### Requirement: Going in and coming back
Going in SHALL replace the city with the inside of that user's office, over a short fade, and SHALL put you on the floor at eye height by the door, looking into the room. The office SHALL be drawn by the same renderer and in the same style as the city.

Coming back SHALL be offered by a control that stays on screen the whole time you are inside, and SHALL put the city back exactly as you left it: the same camera position, the same zoom and the same point in the middle of the screen.

While the office is on screen the city SHALL keep following the server, so a session that started or ended while you were inside is already on the park when you come back. Nothing in the city SHALL answer the pointer while the office is on screen.

#### Scenario: Entering
- **WHEN** the card's way in is used
- **THEN** the city fades out and the office fades in, seen from inside the room at eye height

#### Scenario: Leaving
- **WHEN** the leave control is used
- **THEN** the city comes back with the camera exactly where it was before going in

#### Scenario: Pointer inside
- **WHEN** the pointer moves over the office
- **THEN** no tooltip of a hall, warehouse or HQ is shown

#### Scenario: The city moved on
- **WHEN** a session of another user starts while you are inside, and you then leave
- **THEN** the city shows that session

### Requirement: Walking and looking
Inside the office, W, A, S and D SHALL walk forward, left, back and right, always relative to where you are looking, and the arrow keys SHALL do the same. Holding two of them SHALL NOT walk faster than holding one. Moving the mouse SHALL turn the view. The view SHALL NOT tilt past straight up or straight down and SHALL NOT roll.

Looking around SHALL take the pointer, and the page SHALL say how to give it and how to get it back. Escape SHALL give the pointer back first, and a second Escape SHALL leave the office.

Your own hands SHALL be in view while you are inside. They SHALL swing with the distance you cover and not with the clock, so they come to rest when you stop walking or when something blocks you.

The walls SHALL keep you inside the room, and the desks, the chairs, the robots and the loose furniture SHALL stop you from walking through them. Walking into something at an angle SHALL slide you along it instead of stopping you. Releasing a key, leaving the page, or the window losing focus SHALL stop you walking.

#### Scenario: Walking forward
- **WHEN** W is held
- **THEN** you move through the room in the direction you are looking, at a walking pace

#### Scenario: Strafing
- **WHEN** A is held
- **THEN** you move to the left of where you are looking, without turning

#### Scenario: Two keys at once
- **WHEN** W and D are held together
- **THEN** you move diagonally at the same speed as with one key

#### Scenario: Looking around
- **WHEN** the mouse moves while it has the pointer
- **THEN** the view turns with it and never rolls or flips over

#### Scenario: Taking the pointer
- **WHEN** the office has just been entered
- **THEN** the page says how to take the pointer, and taking it hides the cursor

#### Scenario: Escape while looking
- **WHEN** Escape is pressed while the pointer is taken
- **THEN** the pointer comes back, the cursor is visible and the office is still on screen

#### Scenario: Escape after that
- **WHEN** Escape is pressed again
- **THEN** the office is left and the city comes back

#### Scenario: Walking into a wall
- **WHEN** you walk into a wall head on
- **THEN** you stop at the wall and stay in the room

#### Scenario: Walking into a desk at an angle
- **WHEN** you walk diagonally into a desk
- **THEN** you slide along it instead of coming to a stop

#### Scenario: Walking into a robot
- **WHEN** you walk into a robot
- **THEN** you stop against it

#### Scenario: Your own hands
- **WHEN** you walk across the floor
- **THEN** your hands are in view at the bottom and swing with your steps

#### Scenario: Standing still
- **WHEN** you stop walking
- **THEN** your hands come to rest

#### Scenario: Window loses focus
- **WHEN** a key is held and the window loses focus
- **THEN** you stop walking instead of carrying on

### Requirement: One desk per session
The office floor SHALL hold one desk for every session of its user, however many the server lists for that user and whatever the filter panel shows. Desks SHALL be laid out in rows in a room that grows with the number of desks, so no desk stands in a wall. Every desk SHALL be reachable on foot: the walkways between the rows and along the walls SHALL be wide enough to walk through. A floor SHALL be at least a whole floor of the tower, with open space that no desk stands in.

The room SHALL have four walls, a ceiling and a band of windows, so it reads as a floor of the tower it stands in. A desk SHALL carry a monitor and an open laptop, both showing that session's work in the accent colour of its project, the same colour that session's hall wears in the city, and a chair for its robot. The robot SHALL sit at its desk with its back to the door, so its screens face the room you walk into. The room SHALL be in the user's own tint, the tint the user's halls and tower already use, and SHALL show that user's name.

A session that starts while the office is open SHALL get a desk, and a session that ends SHALL lose one, with the remaining desks laid out again for the new count. When the user has no sessions left the floor SHALL be empty and the office SHALL stay open until it is left.

#### Scenario: Three sessions
- **WHEN** the user runs 3 sessions and its office is entered
- **THEN** the floor holds 3 desks, each with a monitor in its session's project colour

#### Scenario: Room you can walk through
- **WHEN** the user runs 12 sessions and its office is entered
- **THEN** every desk can be walked up to without squeezing past another desk

#### Scenario: Two projects
- **WHEN** two of the sessions run in the same folder and a third runs in another
- **THEN** the first two monitors share a colour and the third differs

#### Scenario: Both screens of a desk
- **WHEN** a desk is looked at from the room
- **THEN** its monitor and its open laptop show the same work

#### Scenario: Session starts while inside
- **WHEN** a session of that user starts while the office is on screen
- **THEN** a desk with a robot appears and the desks are laid out again

#### Scenario: Session ends while inside
- **WHEN** a session of that user ends while the office is on screen
- **THEN** its desk and robot are gone and the desks are laid out again

#### Scenario: Filter is set
- **WHEN** the filter panel hides some of the user's sessions and the office is entered
- **THEN** the floor still holds a desk for every session of that user

#### Scenario: Last session ends
- **WHEN** the user's last session ends while the office is on screen
- **THEN** the floor is empty and the office is still there until it is left

### Requirement: Robots follow their session
Every desk SHALL have a robot sitting on its chair that follows its session's status. A robot whose session is busy SHALL work: it types, its head and upper body move with the work, and its screens fill with new lines under a blinking cursor. A robot whose session is idle SHALL sit back and look slowly around the room, and its screens SHALL stand dark and still, with no cursor. Two robots that are busy at the same time SHALL NOT move in step.

A session's subagents SHALL stand beside its desk as smaller robots, one each, up to four, the same count the yard shows as warehouses. They SHALL appear and disappear with the subagent count of that session.

#### Scenario: Busy session
- **WHEN** a session is busy
- **THEN** its robot types and lines keep arriving on its screens under a blinking cursor

#### Scenario: Idle session
- **WHEN** a session is idle
- **THEN** its robot sits back and looks around, and its screens are dark and still

#### Scenario: Status changes while inside
- **WHEN** a session goes from busy to idle while the office is on screen
- **THEN** its robot stops working and its monitor goes dark, without the desk being rebuilt

#### Scenario: Subagents
- **WHEN** a session reports 3 subagents
- **THEN** 3 smaller robots stand beside its desk

#### Scenario: More subagents than fit
- **WHEN** a session reports 9 subagents
- **THEN** 4 smaller robots stand beside its desk

#### Scenario: Subagent ends
- **WHEN** a session's subagent count drops from 3 to 1
- **THEN** 1 smaller robot is left beside its desk
