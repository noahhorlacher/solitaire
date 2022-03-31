// display settings
const WIDTH = 20 + 7 * 120, HEIGHT = 800;
const DESIGN = {
    BACKGROUND: {
        COLOR: "#68ab68"
    },
    STACK: {
        COLOR: "#fffb",
        LINE_WIDTH: 2
    },
    PULL_STACK: {
        POSITION: {
            X: 20,
            Y: 20
        },
        STACKING_OFFSET: 20
    },
    PUT_STACKS: [
        { POSITION: { X: WIDTH - 1 * 120, Y: 20 } },
        { POSITION: { X: WIDTH - 2 * 120, Y: 20 } },
        { POSITION: { X: WIDTH - 3 * 120, Y: 20 } },
        { POSITION: { X: WIDTH - 4 * 120, Y: 20 } }
    ],
    MAIN_STACKS: [
        { POSITION: { X: 20 + 0 * 120, Y: 240 } },
        { POSITION: { X: 20 + 1 * 120, Y: 240 } },
        { POSITION: { X: 20 + 2 * 120, Y: 240 } },
        { POSITION: { X: 20 + 3 * 120, Y: 240 } },
        { POSITION: { X: 20 + 4 * 120, Y: 240 } },
        { POSITION: { X: 20 + 5 * 120, Y: 240 } },
        { POSITION: { X: 20 + 6 * 120, Y: 240 } }
    ],
    CARD: {
        SIZE: {
            X: 100,
            Y: 140
        },
        RADIUS: 6,
        STACKING_OFFSET: {
            OPEN: 33,
            CLOSED: 10
        }
    },
    CARDS: []
}

// mouse position relative to canvas
let mouse_position = {
    x: null,
    y: null
}

// get canvas and context
const CANVAS = document.querySelector('canvas')
const CTX = CANVAS.getContext('2d')

// set width and height
CANVAS.width = WIDTH
CANVAS.height = HEIGHT

// card properties
const CARD_VALUES = 'A23456789TJQK'.split('')
const CARD_COLORS = 'HDCS'.split('')
const CARD_COLOR_MATCH = {
    H: ['S', 'C'],
    D: ['S', 'C'],
    C: ['H', 'D'],
    S: ['H', 'D']
}

// for animations
const FPS = 60

// whether or not the game is over
let gameover

// count moves
let moves

// array of all cards to copy from
let initial_card_states = []

// all card images for copying
let card_images = {}

// stacks for cards
let pull_stack // top left, draw new cards
let put_stacks // top right, final place for cards
let main_stacks // playing field

// how many cards of the pull_stack lie open
let open_pull_stack_cards

// drag and drop
let mousedown
let drag_stack
let drag_target
let drag_position = {
    x: null,
    y: null
}

// flag if game is loading to skip rendering
let loading = true

// for undo functionality
let last_action

// main rendering function
function render() {
    // render board
    render_board()

    // render cards
    render_cards()
}

// render the background and outlines
function render_board() {
    // render background
    CTX.fillStyle = DESIGN.BACKGROUND.COLOR
    CTX.fillRect(0, 0, WIDTH, HEIGHT)

    // render stacks
    CTX.strokeStyle = DESIGN.STACK.COLOR
    CTX.lineWidth = DESIGN.STACK.LINE_WIDTH

    // drawstack
    const STROKE_OFFSET = DESIGN.STACK.LINE_WIDTH / 2
    CTX.roundRect(
        DESIGN.PULL_STACK.POSITION.X - STROKE_OFFSET,
        DESIGN.PULL_STACK.POSITION.Y - STROKE_OFFSET,
        DESIGN.CARD.SIZE.X + DESIGN.STACK.LINE_WIDTH,
        DESIGN.CARD.SIZE.Y + DESIGN.STACK.LINE_WIDTH,
        DESIGN.CARD.RADIUS
    )
    CTX.stroke()

    // put_stacks
    for (let putstack of DESIGN.PUT_STACKS) {
        CTX.roundRect(
            putstack.POSITION.X - STROKE_OFFSET,
            putstack.POSITION.Y - STROKE_OFFSET,
            DESIGN.CARD.SIZE.X + DESIGN.STACK.LINE_WIDTH,
            DESIGN.CARD.SIZE.Y + DESIGN.STACK.LINE_WIDTH,
            DESIGN.CARD.RADIUS
        )
        CTX.stroke()
    }

    // main stacks
    for (let mainstack of DESIGN.MAIN_STACKS) {
        CTX.roundRect(
            mainstack.POSITION.X - STROKE_OFFSET,
            mainstack.POSITION.Y - STROKE_OFFSET,
            DESIGN.CARD.SIZE.X + DESIGN.STACK.LINE_WIDTH,
            DESIGN.CARD.SIZE.Y + DESIGN.STACK.LINE_WIDTH,
            DESIGN.CARD.RADIUS
        )
        CTX.stroke()
    }
}

// draw one card
function draw_card(card, x, y) {
    let image = card?.open ? card.image : card_images['BACK']
    CTX.drawImage(image, x, y, DESIGN.CARD.SIZE.X, DESIGN.CARD.SIZE.Y)
}

// render the stack to pull from top left
function render_pull_stack() {
    // render left pull_stack side as one closed card
    if (pull_stack.length - open_pull_stack_cards > 0) {
        draw_card(
            null,
            DESIGN.PULL_STACK.POSITION.X,
            DESIGN.PULL_STACK.POSITION.Y
        )
    }

    // render right pull_stack side
    if (open_pull_stack_cards > 0) {
        const RIGHT_SIDE = [...pull_stack].splice(
            pull_stack.length - open_pull_stack_cards,
            Math.min(open_pull_stack_cards, 3) // max 3 cards
        )

        // open right side cards
        RIGHT_SIDE.forEach(card => card.open = true)
        // close all other cards
        pull_stack.filter(card => !RIGHT_SIDE.includes(card)).forEach(card => card.open = false)

        // skip rendering cards that are in drag_stack
        for (let i = 0; i < RIGHT_SIDE.length; i++) {
            let card = RIGHT_SIDE[RIGHT_SIDE.length - 1 - i]
            if (!drag_stack.includes(card)) draw_card(
                card,
                DESIGN.PULL_STACK.POSITION.X + DESIGN.CARD.SIZE.X + 20 + i * DESIGN.PULL_STACK.STACKING_OFFSET,
                DESIGN.PULL_STACK.POSITION.Y
            )
            // save card position for drag and drop
            card.position = {
                x: DESIGN.PULL_STACK.POSITION.X + DESIGN.CARD.SIZE.X + 20 + i * DESIGN.PULL_STACK.STACKING_OFFSET,
                y: DESIGN.PULL_STACK.POSITION.Y
            }
        }
    }
}

// render the main playing stacks bottom
function render_main_stacks() {
    // render main_stacks
    for (let x = 0; x < 7; x++) {
        let current_offset = 0
        main_stacks[x].forEach((card, y) => {
            // save card position for drag and drop
            card.position = {
                x: DESIGN.MAIN_STACKS[x].POSITION.X,
                y: DESIGN.MAIN_STACKS[x].POSITION.Y + current_offset
            }

            // draw cards that aren't in drag_stack
            if (!drag_stack.includes(card)) {
                draw_card(
                    card, // show last card open
                    DESIGN.MAIN_STACKS[x].POSITION.X,
                    DESIGN.MAIN_STACKS[x].POSITION.Y + current_offset
                )
            }

            // increment offset
            if (y < main_stacks[x].length - 1) current_offset += DESIGN.CARD.STACKING_OFFSET[card.open ? 'OPEN' : 'CLOSED']
        })
    }
}

// render the final stacks top right
function render_put_stacks() {
    put_stacks.forEach((putstack, x) => {
        if (putstack.length > 0) {
            let card = putstack[put_stacks[x].length - 1]
            if (!drag_stack.includes(card)) {
                // render topmost card if not in drag_stack
                draw_card(card, DESIGN.PUT_STACKS[x].POSITION.X, DESIGN.PUT_STACKS[x].POSITION.Y)
            } else if (putstack.length > 1) {
                // render next card if there is one
                draw_card(putstack[put_stacks[x].length - 2], DESIGN.PUT_STACKS[x].POSITION.X, DESIGN.PUT_STACKS[x].POSITION.Y)
            }
            // save card position for drag and drop
            putstack[put_stacks[x].length - 1].position = {
                x: DESIGN.PUT_STACKS[x].POSITION.X,
                y: DESIGN.PUT_STACKS[x].POSITION.Y
            }
        }
    })
}

// render the currently dragged stack
function render_drag_stack() {
    drag_stack.forEach((card, i) => {
        let offset = {
            x: drag_position.x - card.position.x,
            y: drag_position.y - card.position.y
        }
        draw_card(card, mouse_position.x - offset.x, mouse_position.y - offset.y)
        delete drag_stack[i].position
    })
}

// render all cards
function render_cards() {
    render_pull_stack()
    render_main_stacks()
    render_put_stacks()
    render_drag_stack()
}

// reset the game
function reset() {
    // reset game variables
    loading = true
    open_pull_stack_cards = 0
    drag_stack = []
    drag_position.x = drag_position.y = null
    drag_target = null
    gameover = false
    last_action == null
    moves = 0

    // disable undo button
    document.querySelector('#undo').setAttribute('disabled', true)

    // reset move display
    document.querySelector('#moves').textContent = `Moves: 0`

    // stop win animation (if it's playing)
    if (animation_stack) animation_stack.forEach(stack => stack.forEach(card => {
        if ('interval' in card) clearInterval(card.interval)
        if ('delay' in card) clearTimeout(card.delay)
    })
    )
    animation_stack = null

    // initialize stacks
    pull_stack = []
    put_stacks = [[], [], [], []]
    main_stacks = [[], [], [], [], [], [], []]

    // reset cards
    initial_card_states.forEach(card => card.open = false)

    // inject cards
    let cards = [...initial_card_states]

    // shuffle cards
    cards.shuffle()

    // put first 24 cards in pull_stack
    pull_stack = cards.splice(0, 24)

    // close pull_stack cards
    pull_stack.forEach(card => card.open = false)

    // put rest in main_stacks
    for (let i = 0; i < 7; i++) main_stacks[i] = cards.splice(0, i + 1)

    // open mainstack cards
    for (let i = 0; i < 7; i++) main_stacks[i][i].open = true

    loading = false

    // start rendering
    render()
}

// setup the game
async function setup() {
    // load card images
    // path prefix for card images
    const card_images_root = '/cards/'

    // load backside
    card_images.BACK = await load_image(`${card_images_root}2B.svg`)

    // load faces
    for (let value of CARD_VALUES)
        for (let color of CARD_COLORS)
            card_images[`${value}${color}`] = await load_image(`${card_images_root}${value}${color}.svg`)

    // make list of card ids to copy from
    for (let value of CARD_VALUES)
        for (let color of CARD_COLORS)
            initial_card_states.push({
                value: value,
                color: color,
                image: card_images[`${value}${color}`],
                open: false
            })

    // start
    reset()
}

// undo the last step
function undo() {
    // ignore if no last action
    if (!last_action) return

    if (last_action.action == 'drop') {
        // if dropped a card or stack of cards
        // if card was opened in last action, close again
        if (last_action.opened_card) main_stacks[last_action.drag_target.x][main_stacks[last_action.drag_target.x].length - 1].open = false

        // remove dropped cards
        if (last_action.drop_target.where == 'main_stack') {
            let drop_target_stack = main_stacks[last_action.drop_target.x]
            drop_target_stack.splice(drop_target_stack.length - last_action.popped_cards.length)
        } else if (last_action.drop_target.where == 'put_stack') {
            let drop_target_stack = put_stacks[last_action.drop_target.x]
            drop_target_stack.splice(drop_target_stack.length - last_action.popped_cards.length)
        }

        // reinsert at old position
        if (last_action.drag_target.where == 'main_stack') {
            let drag_target_stack = main_stacks[last_action.drag_target.x]
            drag_target_stack.push(...last_action.popped_cards)
        } else if (last_action.drag_target.where == 'put_stack') {
            let drag_target_stack = put_stacks[last_action.drag_target.x]
            drag_target_stack.push(...last_action.popped_cards)
        } else if (last_action.drag_target.where == 'pull_stack') {
            let leftover = pull_stack.splice(last_action.drag_target.x)
            pull_stack = [...leftover.reverse(), ...last_action.popped_cards, ...pull_stack.reverse()].reverse()
            open_pull_stack_cards = last_action.old_open_pull_stack_cards
        }
    } else if (last_action.action == 'pull') {
        // if clicked on left side pull stack to reveal a card, undo
        open_pull_stack_cards = last_action.old_open_pull_stack_cards
    }

    // replace last action with last last action
    last_action = last_action.last_action

    if (!last_action) document.querySelector('#undo').setAttribute('disabled', true)

    // decrement move count and update move display
    document.querySelector('#moves').textContent = `Moves: ${--moves}`

    // rerender
    render()
}

// solve and end the game (for testing)
function solve() {
    main_stacks = [[], [], [], [], [], [], []]
    pull_stack = []
    put_stacks = [[], [], [], []]
    let cards = [...initial_card_states]
    for (let card of cards) {
        card.open = true
        let i = CARD_COLORS.indexOf(card.color)
        put_stacks[i].push(card)
    }
    gameover = true
    render()
    start_win_animation()
}

// if started dragging
function ondragstart() {
    // check if a card and which one is being dragged
    let dragcard

    // go through pull_stack to check for drag (uppermost one counts)
    if (open_pull_stack_cards > 0) {
        let opencard_index = [...pull_stack].findIndex(c => c.open === true)
        let pull_stack_opencard = pull_stack[opencard_index]
        if (mouse_over(
            pull_stack_opencard.position.x,
            pull_stack_opencard.position.y,
            DESIGN.CARD.SIZE.X,
            DESIGN.CARD.SIZE.Y
        )) {
            dragcard = [pull_stack_opencard]
            drag_target = {
                where: 'pull_stack',
                x: opencard_index
            }
        }
    }

    // go through main_stacks to check for drag (uppermost one counts)
    if (!dragcard) {
        for (let x = 0; x < main_stacks.length; x++) {
            // if stack has cards
            if (main_stacks[x].length > 0) {
                // check if any card is hovered
                for (let y = main_stacks[x].length - 1; y >= 0; y--) {
                    let card = main_stacks[x][y]

                    // if card is hovered and open
                    if (card.open && mouse_over(
                        card.position.x,
                        card.position.y,
                        DESIGN.CARD.SIZE.X,
                        DESIGN.CARD.SIZE.Y
                    )) {
                        drag_target = {
                            where: 'main_stack',
                            x: x,
                            y: y
                        }
                        dragcard = [card]
                        break
                    }
                }

                // break if found
                if (drag_target) break
            }
        }
    }

    // go through put_stacks to check for drag (uppermost one counts)
    if (!dragcard) {
        for (let x = 0; x < put_stacks.length; x++) {
            // if stack has cards
            if (put_stacks[x].length > 0) {
                // if base is hovered
                if (mouse_over(
                    DESIGN.PUT_STACKS[x].POSITION.X,
                    DESIGN.PUT_STACKS[x].POSITION.Y,
                    DESIGN.CARD.SIZE.X,
                    DESIGN.CARD.SIZE.Y
                )) {
                    drag_target = {
                        where: 'put_stack',
                        x: x
                    }
                    dragcard = [put_stacks[x][put_stacks[x].length - 1]]
                    break
                }
            }
        }
    }

    // if cards are being dragged
    if (dragcard) {
        // if a card from main_stacks is dragged, check if there are cards on top
        if (main_stacks.some(s => s.includes(dragcard[0]))) {
            // get stack index
            let i = main_stacks.findIndex(s => s.includes(dragcard[0]))

            // if not last card of stack
            if (dragcard != [...main_stacks[i]].reverse()[0]) {
                // get card index
                let j = main_stacks[i].findIndex(c => c == dragcard[0])
                drag_stack = [...main_stacks[i]].splice(j)
            }
        } else drag_stack = dragcard

        drag_position.x = mouse_position.x
        drag_position.y = mouse_position.y
    } else {
        mousedown = false
    }
}

// while dragging
function ondrag() {
    render()
}

// check if won or game is unsolvable
function check_gameover() {
    if (!put_stacks.some(stack => stack.length != 13)) {
        // game won
        gameover = true

        // disable undo button
        document.querySelector('#undo').setAttribute('disabled', true)

        // trigger rerender so card falls in place first
        render()

        // start the animation
        start_win_animation()
    }
}

// check if a card can be dropped on a target
function check_for_match(drop_target, drop_card) {
    if (drop_target.where == 'put_stack') {
        let target_stack = put_stacks[drop_target.x]
        // can't drop card on already full putstack
        if (target_stack.length == 13) return false
        // can only drop single card on putstack
        if (drag_stack.length > 1) return false
        // if putstack empty, only ace drop is allowed
        if (target_stack.length == 0) return drop_card.value == 'A'
        // drop only same color and value one higher on non-empty putstack
        let top_card = target_stack[target_stack.length - 1]
        if (
            top_card.color == drop_card.color &&
            CARD_VALUES.indexOf(top_card.value) == CARD_VALUES.indexOf(drop_card.value) - 1
        ) return true
    } else if (drop_target.where == 'main_stack') {
        let target_stack = main_stacks[drop_target.x]
        // if mainstack empty, only king drop is allowed
        if (target_stack.length == 0) return drop_card.value == 'K'
        // drop only opposite color and value one lower on non-empty mainstack
        let top_card = target_stack[target_stack.length - 1]
        if (
            CARD_COLOR_MATCH[top_card.color].includes(drop_card.color) &&
            CARD_VALUES.indexOf(top_card.value) == CARD_VALUES.indexOf(drop_card.value) + 1
        ) return true
    }

    // else, no match
    return false
}

// if stopped dragging
function ondragend() {
    let drop_target

    // go through main_stacks to check for a card mouseover
    for (let x = 0; x < main_stacks.length; x++) {
        // whether some card in the stack is hovered 
        let hovering_over_some_card = main_stacks[x].some(card => {
            if (!card.position) return false
            return mouse_over(
                card.position.x,
                card.position.y,
                DESIGN.CARD.SIZE.X,
                DESIGN.CARD.SIZE.Y
            )
        })

        // whether the base of the stack is hovered
        let mouse_over_base = mouse_over(
            DESIGN.MAIN_STACKS[x].POSITION.X,
            DESIGN.MAIN_STACKS[x].POSITION.Y,
            DESIGN.CARD.SIZE.X,
            DESIGN.CARD.SIZE.Y
        )

        if (hovering_over_some_card || mouse_over_base) {
            drop_target = {
                where: 'main_stack',
                x: x
            }
            break
        }
    }

    // go through put_stacks to check for drag (uppermost one counts)
    if (!drop_target) {
        for (let x = 0; x < put_stacks.length; x++) {
            // whether some card in the stack is hovered
            let hovering_over_some_card = put_stacks[x].some(card => {
                if (!card.position) return false
                return mouse_over(
                    card.position.x,
                    card.position.y,
                    DESIGN.CARD.SIZE.X,
                    DESIGN.CARD.SIZE.Y
                )
            })

            // whether the base of the stack is hovered
            let mouse_over_base = mouse_over(
                DESIGN.PUT_STACKS[x].POSITION.X,
                DESIGN.PUT_STACKS[x].POSITION.Y,
                DESIGN.CARD.SIZE.X,
                DESIGN.CARD.SIZE.Y
            )

            if (hovering_over_some_card || mouse_over_base) {
                drop_target = {
                    where: 'put_stack',
                    x: x
                }
                break
            }
        }
    }

    // if dropping something
    if (drop_target && (drop_target.where != drag_target.where || drop_target.x != drag_target.x)) {
        let popped_cards = [...drag_stack]

        // check if move is valid
        if (check_for_match(drop_target, popped_cards[0])) {
            // save action
            if (drag_target.where == 'pull_stack')
                last_action = {
                    action: 'drop',
                    drag_target: drag_target,
                    drop_target: drop_target,
                    popped_cards: popped_cards,
                    opened_card: false,
                    old_open_pull_stack_cards: open_pull_stack_cards,
                    last_action: last_action
                }
            else
                last_action = {
                    action: 'drop',
                    drag_target: drag_target,
                    drop_target: drop_target,
                    popped_cards: popped_cards,
                    opened_card: false,
                    last_action: last_action
                }

            // enable undo button
            document.querySelector('#undo').setAttribute('disabled', false)

            // increment move count and update move display
            document.querySelector('#moves').textContent = `Moves: ${++moves}`

            // remove card from old stack
            if (drag_target.where == 'main_stack') {
                // remove cards from mainstack
                main_stacks[drag_target.x].splice(drag_target.y)
                // open uppermost card of drag target if it has one left
                if (main_stacks[drag_target.x].length > 0) {
                    main_stacks[drag_target.x][main_stacks[drag_target.x].length - 1].open = true
                    last_action.opened_card = true
                }
            } else if (drag_target.where == 'put_stack') {
                // remove card from putstack
                put_stacks[drag_target.x].splice(put_stacks[drag_target.x].length - 1)
            } else if (drag_target.where == 'pull_stack') {
                // remove card from pull_stack
                pull_stack.splice(drag_target.x, 1)
                // decrement open pull_stack cards amount
                open_pull_stack_cards--
            }

            // push cards to new stack
            if (drop_target.where == 'main_stack') main_stacks[drop_target.x].push(...popped_cards)
            // push cards to new stack
            else if (drop_target.where == 'put_stack') put_stacks[drop_target.x].push(...popped_cards)

            // check if won/lost
            check_gameover()
        }
    }

    // empty drag_stack
    drag_stack = []

    drag_target = null
}

// update mouse position and check for drag
document.addEventListener('mousemove', e => {
    if (loading || gameover) return // skip if loading or game over

    // get mouse coordinates
    const RECT = CANVAS.getBoundingClientRect()
    mouse_position.x = e.clientX - RECT.left
    mouse_position.y = e.clientY - RECT.top

    // drag check/rerender only when inside canvas
    if (mouse_over(0, 0, WIDTH, HEIGHT)) {
        if (drag_stack.length > 0) ondrag()
        else if (mousedown) ondragstart()
    }
})

// event checking
CANVAS.addEventListener('click', e => {
    // for drag check
    mousedown = false

    if (loading || gameover) return // skip if loading or game over

    if (mouse_over(DESIGN.PULL_STACK.POSITION.X, DESIGN.PULL_STACK.POSITION.Y, DESIGN.CARD.SIZE.X, DESIGN.CARD.SIZE.Y)) {
        // clicked on pull_stack left side
        // save action
        last_action = {
            action: 'pull',
            old_open_pull_stack_cards: open_pull_stack_cards,
            last_action: last_action
        }

        // enable undo button
        document.querySelector('#undo').setAttribute('disabled', false)

        // increment move count and update move display
        document.querySelector('#moves').textContent = `Moves: ${++moves}`

        // pull a card
        open_pull_stack_cards = open_pull_stack_cards == pull_stack.length ? 0 : open_pull_stack_cards + 1
    }

    render()
})

// check for drag and drop
CANVAS.addEventListener('mousedown', e => {
    mousedown = true
})
CANVAS.addEventListener('mouseup', e => {
    if (drag_stack.length > 0) ondragend()
    mousedown = false
})

// button actions
document.querySelector('#undo').addEventListener('click', () => {
    if (document.querySelector('#undo').getAttribute('disabled') == 'false') undo()
})
document.querySelector('#reset').addEventListener('click', reset)

// set width of button container
document.querySelector('display').style.width = `${WIDTH}px`

// start
setup()