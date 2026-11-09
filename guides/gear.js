/* Gear options for /guides pages.
 * One catalog for every guide. Each page sets window.GEAR_SLOTS and this file renders it into #gear.
 * Links: a = Amazon product ID (ASIN) -> /dp/ASIN?tag=..., u = full affiliate URL (amzn.to),
 *        otherwise a tagged Amazon search for q (or the product name).
 * Never type prices here (Amazon only allows prices pulled live from its API).
 * use:1 only for gear Stuart actually owns.
 */
(function () {
  var TAG = 'stuartsinglet-20';

  var C = {
    // ---------- Shared: storage, color, backup ----------
    'ssd-budget': { n: 'Crucial X10 Pro', t: 'BUDGET', a: 'B0C9WGGZT9', best: 'Fast, small and cheap for the speed.', pros: ['Pocket size, survives drops and splashes', 'Fastest drive here on a Windows PC with a 20 Gbps port'], cons: ['On a Mac it runs about 1,000 MB/s, same as the others'] },
    'ssd-pick': { n: 'Samsung T7 Shield', t: 'PICK', a: 'B09VLK9W3S', best: 'The safe default for most people.', pros: ['Rubber shell, water and dust resistant', 'Reliable and widely tested'], cons: ['Tops out around 1,000 MB/s'] },
    'ssd-upgrade': { n: 'SanDisk PRO-G40', t: 'UPGRADE', q: 'SanDisk PRO-G40 SSD', best: 'Editing big files straight off the drive on a Mac.', pros: ['Thunderbolt speeds on a Mac', 'Rugged metal body, also works over regular USB-C'], cons: ['Costs much more per terabyte'] },

    'reader-budget': { n: 'Anker 2-in-1 USB-C card reader', t: 'BUDGET', a: 'B07NW8RPYN', best: 'Occasional card dumps.', pros: ['Reads SD and microSD', 'Tiny, no cable to lose'], cons: ['UHS-I only, so fast UHS-II cards copy at about half speed'] },
    'reader-pick': { n: 'ProGrade Digital dual SD UHS-II reader', t: 'PICK', q: 'ProGrade Digital dual SD UHS-II card reader', best: 'Anyone shooting on UHS-II cards (Fujifilm X-T5 included).', pros: ['Full UHS-II speed', 'Two cards at once'], cons: ['Pricier than a basic reader'] },
    'reader-upgrade': { n: 'ProGrade CFexpress B + SD reader', t: 'UPGRADE', q: 'ProGrade Digital CFexpress Type B SD dual slot card reader', best: 'Cameras that use CFexpress cards.', pros: ['Very fast CFexpress transfers', 'SD slot for a second body'], cons: ['Overkill if your camera only takes SD'] },

    'cal-budget': { n: 'Calibrite Display 123', t: 'BUDGET', q: 'Calibrite Display 123 colorimeter', best: 'First calibrator, one-click setup.', pros: ['Simple, guided software', 'Fixes the biggest color errors'], cons: ['Few advanced controls'] },
    'cal-pick': { n: 'Calibrite Display Pro HL', t: 'PICK', q: 'Calibrite Display Pro HL', best: 'Anyone selling prints.', pros: ['Full control over white point and brightness', 'Handles bright modern screens'], cons: ['Takes a few minutes to learn'] },
    'cal-upgrade': { n: 'Calibrite Display Plus HL', t: 'UPGRADE', q: 'Calibrite Display Plus HL', best: 'Very bright HDR displays.', pros: ['Measures extremely bright screens', 'Same pro software as the Pro HL'], cons: ['Overkill for a normal monitor'] },

    'nas-budget': { n: 'Synology DS223j', t: 'BUDGET', q: 'Synology DS223j', best: 'A plain backup box.', pros: ['Synology software at the lowest price', 'Low power, quiet'], cons: ['Weak processor; slow for apps and media servers', 'Memory cannot be upgraded'] },
    'nas-pick': { n: 'Synology DS224+', t: 'PICK', q: 'Synology DS224+', best: 'Backup plus apps, Docker and photo libraries.', pros: ['Same software as the Synology I run', 'Faster processor, upgradable memory'], cons: ['Check Synology\'s drive compatibility list before buying drives'] },
    'nas-upgrade': { n: 'UGREEN NASync DXP4800 Plus', t: 'UPGRADE', q: 'UGREEN NASync DXP4800 Plus', best: 'Four bays and more hardware per dollar.', pros: ['Four drive bays, fast processor', 'Fast networking built in'], cons: ['Younger software with fewer apps than Synology'] },

    'drives-budget': { n: 'Seagate IronWolf', t: 'BUDGET', q: 'Seagate IronWolf NAS hard drive', best: 'Most terabytes per dollar for a NAS.', pros: ['Built to run 24/7 in a NAS', 'Usually a little cheaper'], cons: ['3-year warranty (the Pro line gets 5)'] },
    'drives-pick': { n: 'WD Red Plus', t: 'PICK', q: 'WD Red Plus NAS hard drive', best: 'The common, proven choice.', pros: ['CMR drives, the right kind for a NAS', 'Quiet, widely used'], cons: ['Avoid plain WD Red (no Plus): those are SMR'] },
    'drives-upgrade': { n: 'Synology Plus HAT3300', t: 'UPGRADE', q: 'Synology HAT3300 Plus hard drive', best: 'Zero compatibility worries on a Synology.', pros: ['On every Synology compatibility list', 'Firmware updates through the NAS'], cons: ['Costs more and only makes sense in a Synology'] },

    'ups-budget': { n: 'APC Back-UPS 600', t: 'BUDGET', q: 'APC Back-UPS 600VA BE600M1', best: 'Riding out flickers.', pros: ['Cheap, small', 'USB port so a NAS can shut down cleanly'], cons: ['Short runtime, simulated sine wave'] },
    'ups-pick': { n: 'CyberPower CP1500PFCLCD', t: 'PICK', q: 'CyberPower CP1500PFCLCD', best: 'A NAS, router and modem together.', pros: ['Pure sine wave output', 'Screen shows load and runtime'], cons: ['Heavy and fairly large'] },
    'ups-upgrade': { n: 'APC Smart-UPS 1500', t: 'UPGRADE', q: 'APC Smart-UPS 1500VA SMT1500C', best: 'An office rack or anything you can\'t lose.', pros: ['Business grade, swappable battery', 'Monitoring from your phone'], cons: ['Expensive'] },

    'hdd-budget': { n: 'WD Elements desktop drive', t: 'BUDGET', q: 'WD Elements desktop external hard drive', best: 'The cheap unplugged copy.', pros: ['Very low cost per terabyte', 'Big capacities'], cons: ['Needs wall power, not built for travel'] },
    'hdd-pick': { n: 'Seagate Expansion desktop drive', t: 'PICK', q: 'Seagate Expansion desktop external hard drive', best: 'Same job, a second brand to spread risk.', pros: ['Low cost per terabyte', 'Simple plug-and-copy'], cons: ['Needs wall power'] },
    'hdd-upgrade': { n: 'LaCie Rugged', t: 'UPGRADE', q: 'LaCie Rugged external hard drive', best: 'An offsite copy that travels.', pros: ['Survives drops and rain', 'Powered by the USB cable'], cons: ['Smaller capacities, more per terabyte'] },

    // ---------- Camera (Stuart's) ----------
    'xt5-16-80': { n: 'Fujifilm X-T5 + XF 16-80mm f/4', t: 'PICK', u: 'https://amzn.to/46oFm4o', use: 1, best: 'The body behind almost every photo on this site.', pros: ['40 MP, plenty for 24x36 prints', 'Physical dials, film simulations'], cons: ['Not the fastest autofocus for sports'] },
    'xf35-f14': { n: 'Fujifilm XF 35mm f/1.4 R', t: 'PICK', u: 'https://amzn.to/3TxeA6S', use: 1, best: 'The lens that stays on my camera.', pros: ['Beautiful rendering wide open', 'Small and light'], cons: ['Autofocus is older and a little loud'] },

    // ---------- Prints ----------
    'light-budget': { n: '5000K high CRI LED bulb', t: 'BUDGET', q: '5000K high CRI 95 LED bulb', best: 'Checking prints in any desk lamp.', pros: ['Cheap', 'Daylight color close to how prints are judged'], cons: ['Quality varies by brand; look for CRI 95+'] },
    'light-pick': { n: 'Waveform Lighting D50 bulb', t: 'PICK', q: 'Waveform Lighting D50 LED bulb', best: 'Proofing prints at a proper standard.', pros: ['Very high color accuracy', 'Matches the D50 standard print labs use'], cons: ['Costs more than a regular bulb'] },
    'light-upgrade': { n: 'GTI PDV-3e D50 print viewer', t: 'UPGRADE', q: 'GTI PDV-3e D50 desktop print viewer', best: 'Matching screen to print every time.', pros: ['The viewer pro printers use', 'Even, controlled light'], cons: ['Expensive, takes desk space'] },
    'archival-budget': { n: 'Archival print sleeves', t: 'BUDGET', q: 'acid free archival photo print sleeves', best: 'Keeping proofs clean.', pros: ['Cheap', 'Acid free'], cons: ['No crush protection'] },
    'archival-pick': { n: 'Lineco drop-front archival box', t: 'PICK', q: 'Lineco drop front archival storage box', best: 'Storing finished prints and proofs.', pros: ['Acid free, buffered board', 'Drop front makes flipping through easy'], cons: ['Buy the size that fits your largest print'] },

    // ---------- Files anywhere / home server ----------
    'server-budget': { n: 'Raspberry Pi 5 (8 GB) kit', t: 'BUDGET', q: 'Raspberry Pi 5 8GB starter kit', best: 'Learning, tiny always-on jobs.', pros: ['Very low power', 'Huge community'], cons: ['Linux skills needed; SD cards wear out, use an SSD'] },
    'server-pick': { n: 'Beelink mini PC (Intel N150)', t: 'PICK', q: 'Beelink mini PC N150', best: 'A quiet always-on home server.', pros: ['Low power, silent', 'Runs Ubuntu, Docker and media servers easily'], cons: ['Draws more than a Pi'] },
    'server-upgrade': { n: 'Apple Mac mini (M4)', t: 'UPGRADE', q: 'Apple Mac mini M4', best: 'Mac households that want macOS apps.', pros: ['Fast and very efficient', 'Runs Tailscale and file sharing out of the box'], cons: ['Costs the most; storage upgrades are expensive'] },
    'satassd-budget': { n: 'Crucial MX500', t: 'BUDGET', q: 'Crucial MX500 SATA SSD', best: 'Reviving an old machine.', pros: ['Cheap, reliable', 'Huge speed jump over a spinning disk'], cons: ['SATA only'] },
    'satassd-pick': { n: 'Samsung 870 EVO', t: 'PICK', q: 'Samsung 870 EVO SATA SSD', best: 'The SSD most people trust.', pros: ['Excellent endurance', 'Good management software'], cons: ['A little more than the MX500'] },
    'usb-budget': { n: 'SanDisk Ultra USB drive', t: 'BUDGET', q: 'SanDisk Ultra 32GB USB flash drive', best: 'Making the installer.', pros: ['Cheap', 'Fine for one install'], cons: ['Slow to write'] },
    'usb-pick': { n: 'Samsung BAR Plus', t: 'PICK', q: 'Samsung BAR Plus USB flash drive', best: 'An installer you keep around.', pros: ['Metal body, key ring loop', 'Fast reads'], cons: ['Costs a little more'] },
    'router-budget': { n: 'GL.iNet Opal', t: 'BUDGET', q: 'GL.iNet Opal GL-SFT1200 travel router', best: 'Hotel Wi-Fi on a budget.', pros: ['Cheap, pocket size', 'VPN support'], cons: ['Older Wi-Fi, check Tailscale support for your model'] },
    'router-pick': { n: 'GL.iNet Beryl AX', t: 'PICK', q: 'GL.iNet Beryl AX GL-MT3000', best: 'Travel with your home network.', pros: ['Tailscale built in', 'Wi-Fi 6, USB-C power'], cons: ['Gets warm under load'] },
    'router-upgrade': { n: 'GL.iNet Slate 7', t: 'UPGRADE', q: 'GL.iNet Slate 7 GL-BE3600', best: 'Fastest travel setup.', pros: ['Wi-Fi 7, touchscreen', 'Tailscale built in'], cons: ['Costs the most'] },
    'cat6': { n: 'Cat 6 Ethernet cables', t: 'PICK', q: 'Cat 6 ethernet cable', best: 'Wiring the server and NAS.', pros: ['Faster and steadier than Wi-Fi'], cons: ['Buy the length you need'] },

    // ---------- Second brain ----------
    'monitor-budget': { n: 'ASUS ZenScreen portable monitor', t: 'BUDGET', q: 'ASUS ZenScreen portable monitor USB-C', best: 'A second screen that packs flat.', pros: ['One USB-C cable', 'Fits in a laptop bag'], cons: ['Small and not very bright'] },
    'monitor-pick': { n: 'Dell UltraSharp 27 4K USB-C', t: 'PICK', q: 'Dell UltraSharp 27 4K USB-C hub monitor', best: 'A desk setup with one cable to the laptop.', pros: ['Sharp 4K, accurate color', 'Charges and connects a laptop over one cable'], cons: ['Needs desk space'] },
    'monitor-upgrade': { n: 'Apple Studio Display', t: 'UPGRADE', q: 'Apple Studio Display', best: 'Mac users who want it to just match.', pros: ['5K, matches Mac text sharpness', 'Good camera and speakers built in'], cons: ['Expensive, stand options cost extra'] },

    // ---------- Instagram / content ----------
    'tripod-budget': { n: 'UBeesize phone tripod', t: 'BUDGET', q: 'UBeesize phone tripod with remote', best: 'Starting out.', pros: ['Cheap, includes a Bluetooth remote', 'Bendy legs grip anything'], cons: ['Wobbly at full height'] },
    'tripod-pick': { n: 'Ulanzi MT-44', t: 'PICK', q: 'Ulanzi MT-44 tripod', best: 'Daily phone or small camera shooting.', pros: ['Doubles as a selfie stick', 'Sturdy for its size'], cons: ['Short without a table'] },
    'tripod-upgrade': { n: 'Peak Design Mobile Tripod', t: 'UPGRADE', q: 'Peak Design Mobile Tripod', best: 'Always in your pocket.', pros: ['Wallet-thin, magnetic', 'Very well made'], cons: ['Needs MagSafe or a Peak case'] },
    'wmic-budget': { n: 'Hollyland Lark M2', t: 'BUDGET', q: 'Hollyland Lark M2 wireless microphone', best: 'Clean voice on a budget.', pros: ['Tiny transmitters', 'Phone and camera adapters'], cons: ['Fewer controls than the pricier kits'] },
    'wmic-pick': { n: 'Rode Wireless GO (Gen 3)', t: 'PICK', q: 'Rode Wireless GO Gen 3', best: 'The dependable all-rounder.', pros: ['Records a backup on the transmitter', 'Works with phones and cameras'], cons: ['Costs more than the Lark'] },
    'wmic-upgrade': { n: 'DJI Mic 3', t: 'UPGRADE', q: 'DJI Mic 3', best: 'Most features per dollar.', pros: ['32-bit float backup recording', 'Excellent noise reduction'], cons: ['US stock of DJI gear is unreliable right now'] },
    'led-budget': { n: 'Ulanzi VL49 RGB', t: 'BUDGET', q: 'Ulanzi VL49 RGB LED light', best: 'A pocket fill light.', pros: ['Cheap, magnetic, rechargeable', 'Any color'], cons: ['Small, hard light'] },
    'led-pick': { n: 'Amaran 100x S', t: 'PICK', q: 'Amaran 100x S LED light', best: 'One real key light for videos.', pros: ['Bright, accurate color', 'Takes standard softboxes'], cons: ['Needs a stand and softbox'] },
    'led-upgrade': { n: 'Amaran 150c', t: 'UPGRADE', q: 'Amaran 150c LED light', best: 'Color effects plus key light power.', pros: ['Full color and white', 'App control'], cons: ['Bigger, costs more'] },

    // ---------- Merch ----------
    'tent-budget': { n: 'Foldable light box', t: 'BUDGET', q: 'foldable light box photo tent 16 inch', best: 'Shooting small products at home.', pros: ['Cheap, folds flat', 'Built-in LEDs'], cons: ['Light strips can show as reflections'] },
    'tent-pick': { n: 'Orangemonkie Foldio3', t: 'PICK', q: 'Orangemonkie Foldio3', best: 'Consistent product photos every time.', pros: ['Even, bright light', 'Sets up in seconds'], cons: ['Fixed size limits large items'] },
    'backdrop-budget': { n: 'Savage seamless paper', t: 'BUDGET', q: 'Savage Widetone seamless background paper', best: 'Clean backgrounds for flat lays and apparel.', pros: ['Industry standard paper', 'Many colors'], cons: ['Needs a stand or wall clamps'] },
    'backdrop-pick': { n: 'Savage paper + stand kit', t: 'PICK', q: 'Savage seamless paper background stand kit', best: 'Setting up once and leaving it.', pros: ['Stand included', 'Easy to roll out fresh paper'], cons: ['Takes floor space'] },
    'label-budget': { n: 'Phomemo 4x6 label printer', t: 'BUDGET', q: 'Phomemo 4x6 thermal shipping label printer', best: 'A few orders a week.', pros: ['Cheap, no ink ever', 'Works with standard 4x6 labels'], cons: ['Basic software'] },
    'label-pick': { n: 'Rollo Wireless', t: 'PICK', q: 'Rollo Wireless shipping label printer', best: 'Printing from your phone or laptop.', pros: ['Wireless, prints from any device', 'Any brand of thermal labels'], cons: ['Costs more than wired printers'] },
    'label-upgrade': { n: 'Zebra ZD421', t: 'UPGRADE', q: 'Zebra ZD421 label printer', best: 'High volume shipping.', pros: ['Built to run all day', 'The printer warehouses use'], cons: ['Expensive, setup is more technical'] },
    'scale-budget': { n: 'DYMO M10 postal scale', t: 'BUDGET', q: 'DYMO M10 digital postal scale', best: 'Mailers and small boxes.', pros: ['Simple, accurate', 'Small footprint'], cons: ['10 lb limit'] },
    'scale-pick': { n: 'Ultraship U-2', t: 'PICK', q: 'Ultraship U-2 shipping scale', best: 'Mixed package sizes.', pros: ['Higher weight limit', 'Detachable display'], cons: ['Bigger'] },
    'mailers': { n: 'Padded mailers', t: 'PICK', q: 'padded bubble mailers', best: 'Shirts, prints in rigid sleeves, small items.', pros: ['Cheap and light to ship'], cons: ['Not crush proof'] },

    // ---------- Music ----------
    'book-passman': { n: 'All You Need to Know About the Music Business', t: 'PICK', q: 'Passman All You Need to Know About the Music Business 11th edition', best: 'Read it before you sign anything.', pros: ['The standard reference on publishing, royalties and deals', 'Plain English'], cons: ['Get the newest edition; streaming rules change'] },
    'iface-budget': { n: 'Focusrite Scarlett 2i2 (4th Gen)', t: 'BUDGET', q: 'Focusrite Scarlett 2i2 4th Gen', best: 'Vocal and guitar at home.', pros: ['Two clean preamps, Auto Gain', 'Huge value'], cons: ['No onboard effects while tracking'] },
    'iface-pick': { n: 'Universal Audio Apollo Twin', t: 'PICK', q: 'Universal Audio Apollo Twin X', use: 1, best: 'Writers who want to track through real-sounding gear.', pros: ['UAD plugins while you record, no delay', 'Unison preamps model classic consoles'], cons: ['Thunderbolt, costs much more'] },
    'iface-upgrade': { n: 'Universal Audio Apollo x8p', t: 'UPGRADE', q: 'Universal Audio Apollo x8p', use: 1, best: 'Tracking a full band.', pros: ['Eight Unison preamps', 'Top-tier converters'], cons: ['Rack unit, expensive, overkill for one writer'] },
    'vmic-budget': { n: 'Audio-Technica AT2020', t: 'BUDGET', q: 'Audio-Technica AT2020', best: 'First real vocal mic.', pros: ['Clear, detailed sound', 'Very affordable'], cons: ['Picks up your room, so treat it'] },
    'vmic-pick': { n: 'Shure SM7B', t: 'PICK', a: 'B0002E4Z8M', use: 1, best: 'Vocals in an untreated room.', pros: ['Rejects room noise', 'Sounds great on almost any voice'], cons: ['Needs a lot of gain; weak preamps need an inline booster'] },
    'vmic-upgrade': { n: 'Manley Reference Cardioid', t: 'UPGRADE', q: 'Manley Reference Cardioid tube microphone', use: 1, best: 'A finished, record-ready vocal.', pros: ['Rich tube sound', 'Hand built'], cons: ['Very expensive, wants a treated room'] },
    'hp-budget': { n: 'Sony MDR-7506', t: 'BUDGET', q: 'Sony MDR-7506 headphones', best: 'Tracking on a budget.', pros: ['Studio standard for decades', 'Fold up, cheap'], cons: ['Bright top end, coiled cable'] },
    'hp-pick': { n: 'Audio-Technica ATH-M50x', t: 'PICK', q: 'Audio-Technica ATH-M50x', use: 1, best: 'Tracking and everyday listening.', pros: ['Closed back, keeps the click out of the mic', 'Detachable cables'], cons: ['Can feel tight on long sessions'] },
    'hp-upgrade': { n: 'Slate VSX', t: 'UPGRADE', q: 'Slate VSX headphones', best: 'Checking mixes in different rooms and cars.', pros: ['Simulates studios, cars and clubs', 'Mix anywhere on headphones'], cons: ['Works best with Slate\'s VSX software'], note: 'On my list' },
    'mon-budget': { n: 'Yamaha HS5', t: 'BUDGET', q: 'Yamaha HS5 studio monitor', best: 'Small rooms and desks.', pros: ['Honest, flat sound', 'Fits a desk'], cons: ['Light on low end'] },
    'mon-pick': { n: 'Yamaha HS8', t: 'PICK', q: 'Yamaha HS8 studio monitor', use: 1, best: 'Mixing in a medium room.', pros: ['Flat and revealing', 'Real low end'], cons: ['Big for a small room'] },
    'mon-upgrade': { n: 'Yamaha HS8S subwoofer', t: 'UPGRADE', q: 'Yamaha HS8S subwoofer', use: 1, best: 'Hearing the sub bass in modern records.', pros: ['Matches the HS speakers', 'Shows what is under the kick and 808'], cons: ['Needs careful placement and level setting'] },

    // ---------- Home emergency kit ----------
    'water-budget': { n: 'Reliance Aqua-Tainer 7 gal', t: 'BUDGET', q: 'Reliance Aqua-Tainer 7 gallon water container', best: 'Cheapest way to store a few days of water.', pros: ['Rigid, built-in spigot', 'Stacks on its side'], cons: ['About 60 lb full, hard to lift'] },
    'water-pick': { n: 'WaterBrick 3.5 gal', t: 'PICK', q: 'WaterBrick 3.5 gallon water container', best: 'Storing water in closets and under beds.', pros: ['Stack like bricks', 'About 30 lb full, easy to carry'], cons: ['Costs more per gallon'] },
    'water-upgrade': { n: '55 gal water drum + pump', t: 'UPGRADE', q: '55 gallon water storage drum kit siphon pump', best: 'Two weeks or more for a family.', pros: ['Most water per dollar and per square foot', 'One container to rotate'], cons: ['Over 450 lb full, needs a pump and a permanent spot'] },
    'waterbob': { n: 'WaterBOB bathtub bladder', t: 'PICK', q: 'WaterBOB bathtub emergency water storage', best: 'When a storm or outage is coming.', pros: ['Holds about 100 gallons in a tub', 'Keeps the water clean'], cons: ['Only works if you fill it before the taps stop'] },
    'filter-budget': { n: 'LifeStraw Personal', t: 'BUDGET', q: 'LifeStraw Personal water filter', best: 'One for every go-bag.', pros: ['Cheap, light, no parts', 'Removes bacteria and parasites'], cons: ['You drink through it; it can\'t fill containers'] },
    'filter-pick': { n: 'Sawyer Squeeze', t: 'PICK', q: 'Sawyer Squeeze water filter', best: 'Filtering water for the house.', pros: ['Fills bottles and pots', 'Lasts a very long time, backflushes clean'], cons: ['Doesn\'t remove viruses; ruined if it freezes wet'] },
    'filter-upgrade': { n: 'Platypus GravityWorks 4L', t: 'UPGRADE', q: 'Platypus GravityWorks 4L water filter', best: 'A family, hands free.', pros: ['Hang it and it filters on its own', 'Fast flow'], cons: ['Doesn\'t remove viruses; costs more'] },
    'treat-budget': { n: 'Aquatabs', t: 'BUDGET', q: 'Aquatabs water purification tablets', best: 'Killing viruses after filtering.', pros: ['Cheap, tiny, long shelf life', 'Kills bacteria and viruses'], cons: ['Chlorine taste; weak against Cryptosporidium'] },
    'treat-pick': { n: 'Katadyn Micropur MP1', t: 'PICK', q: 'Katadyn Micropur MP1 purification tablets', best: 'The most complete tablet.', pros: ['Kills viruses, bacteria, Giardia and Crypto', 'Less taste than chlorine'], cons: ['Up to 4 hours for Crypto'] },
    'pb-budget': { n: 'Anker 20,000 mAh power bank', t: 'BUDGET', q: 'Anker 20000mAh portable power bank', best: 'Phones and radios.', pros: ['Several phone charges', 'Cheap and light'], cons: ['Can\'t run anything that plugs into a wall'] },
    'pb-pick': { n: 'Anker Prime 26,250 mAh', t: 'PICK', q: 'Anker Prime 26250mAh power bank', best: 'Phones plus a laptop.', pros: ['Fast enough to charge laptops', 'Screen shows what is left'], cons: ['Heavier, pricier'] },
    'ps-budget': { n: 'Anker SOLIX C1000', t: 'BUDGET', q: 'Anker SOLIX C1000 portable power station', best: 'About 1 kWh without paying top dollar.', pros: ['LiFePO4 battery lasts years of cycles', 'Recharges from the wall fast'], cons: ['Heavy (around 28 lb)'] },
    'ps-pick': { n: 'EcoFlow River 3 Plus + extra battery', t: 'PICK', a: 'B0DPW7T85G', use: 1, best: 'Running a computer, router and lights through an outage.', pros: ['Works as a battery backup: no blip when the power drops', 'Add-on battery stacks underneath when you need more'], cons: ['On its own it lasts hours, not days, with bigger loads'] },
    'ps-upgrade': { n: 'EcoFlow DELTA 3 Plus', t: 'UPGRADE', q: 'EcoFlow DELTA 3 Plus portable power station', best: 'Keeping a fridge or medical gear going.', pros: ['About 1 kWh, expandable', 'Powerful enough for a fridge'], cons: ['Heavy, costs more'] },
    'solar-budget': { n: 'Jackery SolarSaga 100W', t: 'BUDGET', q: 'Jackery SolarSaga 100W solar panel', best: 'Topping up a small station.', pros: ['Folds into a case', 'Cheaper'], cons: ['100W charges a big station slowly'] },
    'solar-pick': { n: 'EcoFlow 220W bifacial panel', t: 'PICK', q: 'EcoFlow 220W bifacial portable solar panel', use: 1, best: 'Recharging a station in a day of sun.', pros: ['Collects light on both sides', 'Twice the power of a 100W panel'], cons: ['Bulky; easiest with EcoFlow stations'] },
    'gen-budget': { n: 'Champion 2500W dual fuel inverter', t: 'BUDGET', q: 'Champion 2500 watt dual fuel inverter generator', best: 'Long outages on a budget.', pros: ['Runs on propane or gas', 'Quiet for a generator'], cons: ['Outdoors only, 20+ ft from the house', 'Needs fuel and maintenance'] },
    'gen-pick': { n: 'Honda EU2200i', t: 'PICK', a: 'B079YF1HF6', best: 'The one that starts every time.', pros: ['Famous reliability', 'Very quiet'], cons: ['Gas only, expensive', 'Outdoors only, 20+ ft from the house'] },
    'headlamp-budget': { n: 'Energizer Vision', t: 'BUDGET', q: 'Energizer Vision headlamp', best: 'One in every drawer.', pros: ['Cheap, AAA batteries', 'Light and simple'], cons: ['Dimmer than the others'] },
    'headlamp-pick': { n: 'Black Diamond Spot 400', t: 'PICK', q: 'Black Diamond Spot 400 headlamp', best: 'The one you reach for first.', pros: ['Bright, waterproof', 'Red mode keeps night vision'], cons: ['Burns through AAAs on high'] },
    'headlamp-upgrade': { n: 'Fenix HM65R', t: 'UPGRADE', q: 'Fenix HM65R headlamp', best: 'Working outside in the dark.', pros: ['Very bright, metal body', 'USB-C rechargeable'], cons: ['Pricey, keep it charged'] },
    'lantern-budget': { n: 'LuminAID solar lantern', t: 'BUDGET', q: 'LuminAID solar inflatable lantern', best: 'Light with no batteries at all.', pros: ['Charges in the sun', 'Packs flat'], cons: ['Dim'] },
    'lantern-pick': { n: 'Goal Zero Lighthouse Micro Flash', t: 'PICK', q: 'Goal Zero Lighthouse Micro Flash lantern', best: 'Lighting a room.', pros: ['Lantern and flashlight in one', 'USB rechargeable'], cons: ['Small'] },
    'batt-budget': { n: 'Energizer Ultimate Lithium AA', t: 'BUDGET', q: 'Energizer Ultimate Lithium AA batteries', best: 'Batteries that sit in a kit for years.', pros: ['Up to 20 years in storage', 'Work in the cold'], cons: ['Single use'] },
    'batt-pick': { n: 'Panasonic Eneloop AA + charger', t: 'PICK', q: 'Panasonic Eneloop AA with charger', best: 'Everyday gear you also want in an outage.', pros: ['Recharge hundreds of times', 'Hold their charge in storage'], cons: ['Need power to recharge'] },
    'radio-budget': { n: 'Midland ER210', t: 'BUDGET', q: 'Midland ER210 emergency crank radio', best: 'News and weather with no power.', pros: ['Crank, solar or battery', 'NOAA weather channels, flashlight'], cons: ['No county-specific alerts'] },
    'radio-pick': { n: 'Midland ER310', t: 'PICK', q: 'Midland ER310 emergency crank radio', best: 'The kit radio.', pros: ['Bigger battery, charges a phone', 'NOAA weather alerts'], cons: ['Larger than the ER210'] },
    'radio-upgrade': { n: 'Midland WR400', t: 'UPGRADE', q: 'Midland WR400 NOAA weather alert radio', best: 'Waking you up for a tornado warning.', pros: ['Alerts only for your county', 'Loud alarm, battery backup'], cons: ['A desk unit, not portable'] },
    'twoway-budget': { n: 'Motorola Talkabout T470', t: 'BUDGET', q: 'Motorola Talkabout T470 two-way radio', best: 'Talking to family on the block.', pros: ['No license needed', 'Weather alerts'], cons: ['Real range is much shorter than the box says'] },
    'twoway-pick': { n: 'Midland GXT67 Pro', t: 'PICK', q: 'Midland GXT67 Pro GMRS radio', best: 'Longer range across town.', pros: ['More power than license-free radios', 'Works with GMRS repeaters'], cons: ['Needs an FCC GMRS license (no test, covers your family)'] },
    'heater': { n: 'Mr. Heater Big Buddy', t: 'PICK', q: 'Mr. Heater Big Buddy indoor safe propane heater', best: 'Heat in a winter outage.', pros: ['Rated for indoor use with low-oxygen and tip-over shutoff', 'Runs on small propane bottles'], cons: ['Still needs a CO alarm and a cracked window'] },
    'co-budget': { n: 'Kidde battery CO alarm', t: 'BUDGET', q: 'Kidde battery carbon monoxide alarm', best: 'Every floor, every heater room.', pros: ['Battery powered, works with the power out', 'Cheap'], cons: ['CO only'] },
    'co-pick': { n: 'First Alert smoke + CO alarm', t: 'PICK', q: 'First Alert battery smoke and carbon monoxide combo alarm', best: 'Bedrooms and hallways.', pros: ['Smoke and CO in one', 'Battery powered'], cons: ['Replace the whole unit at end of life'] },
    'stove-budget': { n: 'Iwatani 35FW butane stove', t: 'BUDGET', q: 'Iwatani 35FW butane stove', best: 'Cooking real meals in a ventilated space.', pros: ['Great flame control', 'Compact, cheap fuel cans'], cons: ['Butane struggles in the cold; ventilate'] },
    'stove-pick': { n: 'Coleman Classic propane stove', t: 'PICK', q: 'Coleman Classic propane camp stove', best: 'Cooking outside for a family.', pros: ['Two burners', 'Common fuel'], cons: ['Outdoors only'] },
    'stove-upgrade': { n: 'Jetboil Flash', t: 'UPGRADE', q: 'Jetboil Flash cooking system', best: 'Boiling water fast with little fuel.', pros: ['Boils in a couple of minutes', 'Very fuel efficient'], cons: ['Boils water; it doesn\'t really cook'] },
    'fan-budget': { n: 'Battery fan', t: 'BUDGET', q: 'O2COOL battery powered fan', best: 'Summer outages.', pros: ['Runs on D or AA batteries', 'Cheap'], cons: ['Light airflow'] },
    'fan-pick': { n: 'Rechargeable clip fan', t: 'PICK', q: 'rechargeable battery clip fan USB-C', best: 'Sleeping through a hot night.', pros: ['Hours per charge, clips to a bed or desk', 'Charges from a power bank'], cons: ['Small'] },
    'food-budget': { n: 'Mountain House #10 cans', t: 'BUDGET', q: 'Mountain House #10 can freeze dried food', best: 'Food that lasts decades.', pros: ['Very long shelf life', 'Actually tastes good'], cons: ['Expensive; needs water'] },
    'food-pick': { n: 'ReadyWise emergency food bucket', t: 'PICK', q: 'ReadyWise emergency food supply bucket', best: 'Lots of servings in one box.', pros: ['Low cost per serving', 'Stackable buckets'], cons: ['Servings are small: count calories, not servings'] },
    'opener-budget': { n: 'P-38 can opener', t: 'BUDGET', q: 'P-38 can opener', best: 'Every kit and key ring.', pros: ['Tiny, never breaks'], cons: ['Slow'] },
    'opener-pick': { n: 'OXO manual can opener', t: 'PICK', q: 'OXO Good Grips manual can opener', best: 'The kitchen drawer.', pros: ['Easy grip, smooth'], cons: ['Bulky for a bag'] },
    'toilet': { n: 'Reliance Luggable Loo', t: 'PICK', q: 'Reliance Luggable Loo portable toilet', best: 'When the toilets stop working.', pros: ['Snaps onto a 5 gallon bucket', 'Cheap'], cons: ['Needs bags and absorbent'] },
    'toilet-bags': { n: 'Double Doodie toilet bags', t: 'PICK', q: 'Double Doodie toilet waste bags', best: 'Pair with the Luggable Loo.', pros: ['Gel absorbs and controls odor'], cons: ['Consumable, buy plenty'] },
    'bags': { n: 'Contractor trash bags', t: 'PICK', q: 'heavy duty contractor trash bags', best: 'Waste, tarps, rain gear.', pros: ['Thick and cheap'], cons: [] },
    'aid-budget': { n: 'Adventure Medical Kits', t: 'BUDGET', q: 'Adventure Medical Kits first aid kit', best: 'Everyday cuts and burns.', pros: ['Well organized', 'Good value'], cons: ['Light on trauma supplies'] },
    'aid-pick': { n: 'MyMedic MyFAK', t: 'PICK', q: 'MyMedic MyFAK first aid kit', best: 'A serious household kit.', pros: ['Includes trauma supplies', 'Labeled, organized pockets'], cons: ['Expensive'] },
    'tq': { n: 'CAT Gen 7 tourniquet', t: 'PICK', q: 'North American Rescue CAT Gen 7 tourniquet', best: 'Severe bleeding.', pros: ['The tourniquet most first responders carry'], cons: ['Counterfeits are common: buy only from North American Rescue, and take a Stop the Bleed class'] },
    'book-doctor': { n: 'Where There Is No Doctor', t: 'PICK', q: 'Where There Is No Doctor Hesperian', best: 'Medical care when help can\'t come.', pros: ['The most recommended offline medical book', 'Written for non-doctors'], cons: ['Written for low-resource settings, not suburbs'] },
    'book-sas': { n: 'SAS Survival Handbook', t: 'PICK', q: 'SAS Survival Handbook', best: 'General skills reference.', pros: ['Covers almost everything', 'Lots of diagrams'], cons: ['Mostly wilderness focused'] },
    'book-ball': { n: 'Ball Blue Book Guide to Preserving', t: 'PICK', q: 'Ball Blue Book Guide to Preserving', best: 'Canning and storing food safely.', pros: ['Tested recipes and safe methods'], cons: ['Only useful if you can or plan to'] },
    'doc-budget': { n: 'Fire-resistant document bag', t: 'BUDGET', q: 'fireproof waterproof document bag', best: 'Grab-and-go papers.', pros: ['Cheap, light, grab it on the way out'], cons: ['Fire resistant, not fireproof'] },
    'doc-pick': { n: 'SentrySafe fire and water chest', t: 'PICK', q: 'SentrySafe fire and water chest', best: 'Originals at home.', pros: ['Fire and water rated', 'Fits passports and deeds'], cons: ['Heavy, not theft proof'] },
    'doc-upgrade': { n: 'Kingston IronKey encrypted USB', t: 'UPGRADE', q: 'Kingston IronKey encrypted USB drive', best: 'Digital copies of IDs, insurance and deeds.', pros: ['Hardware encryption', 'Wipes itself after too many wrong passwords'], cons: ['Pricey; lose the password and it\'s gone'] },
    'lib-budget': { n: 'Raspberry Pi 5 (8 GB) kit', t: 'BUDGET', q: 'Raspberry Pi 5 8GB starter kit', best: 'A tiny offline library server.', pros: ['Runs for days on a small battery', 'Cheap'], cons: ['Some Linux setup; add an SSD'] },
    'lib-pick': { n: 'Beelink mini PC (Intel N150)', t: 'PICK', q: 'Beelink mini PC N150', best: 'An offline library with room to grow.', pros: ['More storage and speed', 'Still low power'], cons: ['Uses more battery than a Pi'] },
    'ereader-budget': { n: 'Kobo Clara', t: 'BUDGET', q: 'Kobo Clara e-reader', best: 'Reading free and library books offline.', pros: ['Reads EPUB files directly', 'Waterproof'], cons: ['Smaller store than Kindle'] },
    'ereader-pick': { n: 'Kindle Paperwhite', t: 'PICK', q: 'Kindle Paperwhite', best: 'Weeks of reading on one charge.', pros: ['Long battery, waterproof', 'Huge store'], cons: ['Prefers Amazon\'s formats'] },
    'multi-budget': { n: 'Gerber multitool', t: 'BUDGET', q: 'Gerber multitool', best: 'A spare in the car.', pros: ['Cheap, solid'], cons: ['Fewer locking tools'] },
    'multi-pick': { n: 'Leatherman Wave+', t: 'PICK', q: 'Leatherman Wave Plus multitool', best: 'The one you carry.', pros: ['Locking blades, replaceable wire cutters', '25-year warranty'], cons: ['Heavier'] },
    'shutoff': { n: 'Gas and water shutoff wrench', t: 'PICK', q: '4 in 1 emergency gas water shutoff wrench', best: 'Next to the meter.', pros: ['Turns off gas and water fast'], cons: ['Only turn gas off if you smell a leak; the gas company has to turn it back on'] },
    'ext-budget': { n: 'First Alert home extinguisher', t: 'BUDGET', q: 'First Alert home fire extinguisher', best: 'Kitchen and garage.', pros: ['Cheap, easy to use'], cons: ['Not rechargeable'] },
    'ext-pick': { n: 'Amerex 5 lb ABC', t: 'PICK', q: 'Amerex 5 lb ABC fire extinguisher', best: 'One per floor.', pros: ['Commercial grade, metal valve', 'Rechargeable'], cons: ['Heavier'] },
    'faraday': { n: 'Mission Darkness Faraday bag', t: 'PICK', q: 'Mission Darkness faraday bag', best: 'A backup drive or spare phone.', pros: ['Blocks wireless signals', 'Well made'], cons: ['Honestly, a power surge is a bigger risk than an EMP'] }
  };

  function link(id, it) {
    if (it.u) return it.u;
    if (it.a) return 'https://www.amazon.com/dp/' + it.a + '?tag=' + TAG;
    return 'https://www.amazon.com/s?k=' + encodeURIComponent(it.q || it.n) + '&tag=' + TAG;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var css = ''
    + '.gx-slot{margin:0 0 34px}'
    + '.gx-label{font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#777;margin:0 0 4px}'
    + '.gx-note{font-size:12.5px;font-weight:300;color:#7c7c7c;line-height:1.55;margin:0 0 12px;max-width:620px}'
    + '.gx-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}'
    + '.gx-row.n1{grid-template-columns:minmax(0,420px)}.gx-row.n2{grid-template-columns:repeat(2,1fr)}'
    + '.gx-card{display:flex;flex-direction:column;border:1px solid #1d1d1d;padding:16px 16px 14px;text-decoration:none;color:inherit;transition:border-color .2s;min-width:0}'
    + '.gx-card:hover{border-color:#555}'
    + '.gx-card.pick{border-color:#333}'
    + '.gx-top{display:flex;gap:6px;align-items:center;margin-bottom:10px;flex-wrap:wrap}'
    + '.gx-tier{font-family:var(--mono);font-size:9px;letter-spacing:.18em;color:#888;border:1px solid #2a2a2a;padding:3px 7px}'
    + '.gx-card.pick .gx-tier{color:#eee;border-color:#666}'
    + '.gx-use{font-family:var(--mono);font-size:9px;letter-spacing:.16em;color:#050505;background:#d8d8d8;padding:3px 7px}'
    + '.gx-want{font-family:var(--mono);font-size:9px;letter-spacing:.16em;color:#bbb;border:1px dashed #444;padding:3px 7px}'
    + '.gx-n{font-family:var(--display);font-size:24px;letter-spacing:.03em;line-height:1.02;color:#d8d8d8;margin:0 0 6px}'
    + '.gx-card:hover .gx-n{color:#fff}'
    + '.gx-best{font-size:12.5px;font-weight:300;color:#9a9a9a;line-height:1.5;margin:0 0 10px}'
    + '.gx-l{list-style:none;padding:0;margin:0 0 4px;font-size:12px;font-weight:300;line-height:1.5;color:#8a8a8a}'
    + '.gx-l li{padding-left:16px;position:relative;margin:0 0 3px}'
    + '.gx-l li:before{position:absolute;left:0;font-family:var(--mono);color:#666}'
    + '.gx-l.p li:before{content:"+"}.gx-l.c li:before{content:"\\2212"}'
    + '.gx-l.c li{color:#6f6f6f}'
    + '.gx-cta{margin-top:auto;padding-top:12px;font-family:var(--mono);font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:#777}'
    + '.gx-card:hover .gx-cta{color:#fff}'
    + '@media (max-width:760px){.gx-row,.gx-row.n2{grid-template-columns:1fr}}'
    + '@media (hover:none){.gx-card:hover{border-color:#1d1d1d}.gx-card.pick:hover{border-color:#333}.gx-card:hover .gx-n{color:#d8d8d8}.gx-card:hover .gx-cta{color:#777}}';

  function render() {
    var root = document.getElementById('gear');
    var slots = window.GEAR_SLOTS;
    if (!root || !slots) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var html = '';
    slots.forEach(function (g) {
      html += '<section class="group"><div class="group-h"><span>' + esc(g.group) + '</span></div>';
      (g.slots || []).forEach(function (s) {
        var ids = s.ids.filter(function (id) { return C[id]; });
        if (!ids.length) return;
        html += '<div class="gx-slot">' + (s.label ? '<div class="gx-label">' + esc(s.label) + '</div>' : '') + (s.note ? '<p class="gx-note">' + esc(s.note) + '</p>' : '');
        html += '<div class="gx-row n' + Math.min(ids.length, 3) + '">';
        ids.forEach(function (id) {
          var it = C[id];
          html += '<a class="gx-card' + (it.t === 'PICK' ? ' pick' : '') + '" href="' + esc(link(id, it)) + '" target="_blank" rel="noopener sponsored nofollow" data-slug="' + esc(id) + '">'
            + '<div class="gx-top">' + (ids.length > 1 ? '<span class="gx-tier">' + it.t + '</span>' : '') + (it.use ? '<span class="gx-use">I use this</span>' : '') + (it.note ? '<span class="gx-want">' + esc(it.note) + '</span>' : '') + '</div>'
            + '<div class="gx-n">' + esc(it.n) + '</div>'
            + (it.best ? '<p class="gx-best">' + esc(it.best) + '</p>' : '')
            + (it.pros && it.pros.length ? '<ul class="gx-l p">' + it.pros.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '')
            + (it.cons && it.cons.length ? '<ul class="gx-l c">' + it.cons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '')
            + '<div class="gx-cta">Check price on Amazon ↗</div></a>';
        });
        html += '</div></div>';
      });
      html += '</section>';
    });
    root.innerHTML = html;
    root.addEventListener('click', function (e) {
      var a = e.target.closest('a.gx-card'); if (!a) return;
      try { gtag('event', 'gear_click', { item: a.dataset.slug, list: 'guide' }); } catch (x) {}
      try { window.__ssSend && window.__ssSend('gear_click', null, { item: a.dataset.slug, list: 'guide' }); } catch (x) {}
    });
  }
  window.GEAR_CATALOG = C;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
})();
