#!/usr/bin/env npx tsx
/**
 * Generate 500 optimized search terms based on historical performance analysis
 *
 * Strategy:
 * 1. Focus on underrepresented high-potential first letters (F, K, N, E, V, O, Y, Z)
 * 2. Use 2-3 character prefixes for maximum coverage
 * 3. Leverage successful patterns: names, street terms, geographic features
 * 4. Avoid known zero-result patterns (LLC, Inc, LLP, LP)
 * 5. Target new combinations not yet tried
 */

import { prisma } from '../lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

// Already tried terms from database analysis
const alreadyTriedSet = new Set<string>();

async function loadAlreadyTriedTerms() {
  console.log('Loading already-tried search terms...');
  const existingTerms = await prisma.scrapeJob.findMany({
    select: { searchTerm: true },
    distinct: ['searchTerm']
  });

  existingTerms.forEach(t => alreadyTriedSet.add(t.searchTerm.toLowerCase()));
  console.log(`Loaded ${alreadyTriedSet.size} already-tried terms`);
}

function hasBeenTried(term: string): boolean {
  return alreadyTriedSet.has(term.toLowerCase());
}

// Generate optimized search terms based on analysis
function generateOptimizedTerms(): string[] {
  const terms: string[] = [];

  // 1. Underrepresented first letter names (F, K, N, E, V, O names)
  const fNames = ['Frank', 'Fred', 'Felix', 'Fernando', 'Francis', 'Floyd', 'Foster', 'Franklin',
    'Freeman', 'Frost', 'Fuller', 'Fran', 'Faith', 'Faye', 'Felicia', 'Fern'];

  const kNames = ['Kelly', 'Kenneth', 'Kevin', 'Keith', 'Kyle', 'Katherine', 'Kathy', 'Karen',
    'Kim', 'Kimberly', 'Kristin', 'Kristen', 'Kent', 'Kirk', 'Kurt', 'Kay', 'Kara'];

  const nNames = ['Nancy', 'Nicholas', 'Nicole', 'Nathan', 'Natalie', 'Neil', 'Norman', 'Norma',
    'Noah', 'Nora', 'Neal', 'Nina', 'Noel', 'Ned'];

  const eNames = ['Elizabeth', 'Emily', 'Emma', 'Ethan', 'Eric', 'Edward', 'Eugene', 'Evelyn',
    'Ernest', 'Earl', 'Elaine', 'Eleanor', 'Ellen', 'Elijah', 'Evan', 'Erin'];

  const vNames = ['Victoria', 'Vincent', 'Valerie', 'Victor', 'Virginia', 'Veronica', 'Vince',
    'Vivian', 'Vernon', 'Vera', 'Violet', 'Van', 'Vaughn'];

  const oNames = ['Oscar', 'Oliver', 'Olivia', 'Owen', 'Otis', 'Orlando', 'Ophelia', 'Orville'];

  const yNames = ['Yvonne', 'Yolanda', 'York', 'Young'];

  const zNames = ['Zachary', 'Zoe', 'Zach', 'Zimmerman', 'Zhang'];

  // 2. Common last names not yet tried or underutilized
  const lastNames = [
    'Abbott', 'Adkins', 'Archer', 'Armstrong', 'Arnold',
    'Baldwin', 'Ball', 'Banks', 'Barber', 'Bass', 'Bates', 'Beck', 'Becker', 'Bell', 'Bennett',
    'Benson', 'Berg', 'Berry', 'Bishop', 'Blair', 'Blake', 'Bolton', 'Bond', 'Boone', 'Booth',
    'Bowen', 'Bowers', 'Boyd', 'Brady', 'Branch', 'Brennan', 'Brock', 'Brooks', 'Bryan', 'Bryant',
    'Buchanan', 'Buck', 'Burgess', 'Burke', 'Burns', 'Burton', 'Bush', 'Butler',
    'Caldwell', 'Callahan', 'Cameron', 'Campbell', 'Cannon', 'Cardenas', 'Carey', 'Carlton',
    'Carpenter', 'Carr', 'Carson', 'Case', 'Casey', 'Castro', 'Chambers', 'Chan', 'Chang',
    'Chapman', 'Chen', 'Christensen', 'Chu', 'Clay', 'Clayton', 'Cline', 'Cobb', 'Cochran',
    'Cohen', 'Cole', 'Coleman', 'Collier', 'Combs', 'Conner', 'Conway', 'Cook', 'Cooke',
    'Cooper', 'Copeland', 'Cortez', 'Costa', 'Cox', 'Craig', 'Crane', 'Crosby',
    'Dalton', 'Daniel', 'Daniels', 'Daugherty', 'Davidson', 'Dawson', 'Day', 'Dean', 'Decker',
    'Deleon', 'Delgado', 'Dennis', 'Diaz', 'Dickerson', 'Dickson', 'Dixon', 'Dodson', 'Donaldson',
    'Donovan', 'Douglas', 'Doyle', 'Drake', 'Dudley', 'Duke', 'Duncan', 'Dunn', 'Dyer',
    'Eaton', 'Elliott', 'Ellis', 'English', 'Erickson', 'Espinoza', 'Estes', 'Evans',
    'Farmer', 'Farrell', 'Ferguson', 'Fernandez', 'Fields', 'Figueroa', 'Finley', 'Fischer',
    'Fisher', 'Fleming', 'Fletcher', 'Flores', 'Flynn', 'Foley', 'Ford', 'Foster', 'Fowler',
    'Francis', 'Frank', 'Franklin', 'Frazier', 'Freeman', 'French', 'Fritz', 'Frost', 'Fry', 'Fuller',
    'Gallagher', 'Galloway', 'Gamble', 'Garner', 'Garrett', 'Gates', 'Gay', 'Gentry', 'George',
    'Gibbs', 'Gibson', 'Gilbert', 'Giles', 'Gillespie', 'Glenn', 'Glover', 'Golden', 'Goldman',
    'Gomez', 'Goodman', 'Goodwin', 'Gordon', 'Gould', 'Graham', 'Grant', 'Graves', 'Gray', 'Greene',
    'Greer', 'Gregory', 'Griffin', 'Griffith', 'Gross', 'Guerra', 'Guerrero', 'Guzman',
    'Hahn', 'Hale', 'Haley', 'Hall', 'Hamilton', 'Hammond', 'Hampton', 'Hancock', 'Haney',
    'Hansen', 'Hanson', 'Hardin', 'Hardy', 'Harmon', 'Harper', 'Harrington', 'Harrison', 'Hart',
    'Harvey', 'Hatfield', 'Hawkins', 'Hayes', 'Haynes', 'Heath', 'Henderson', 'Hendrix', 'Henry',
    'Henson', 'Herman', 'Hernandez', 'Herrera', 'Hickman', 'Hicks', 'Higgins', 'Hines', 'Hinton',
    'Hobbs', 'Hodge', 'Hodges', 'Hoffman', 'Hogan', 'Holland', 'Holloway', 'Holmes', 'Holt',
    'Hood', 'Hooper', 'Horn', 'Horne', 'Horton', 'House', 'Houston', 'Howard', 'Howe', 'Howell',
    'Huang', 'Hubbard', 'Hudson', 'Huff', 'Huffman', 'Hughes', 'Hull', 'Humphrey', 'Hunt', 'Hunter',
    'Hurst', 'Hutchinson', 'Hyde',
    'Ingram', 'Irwin',
    'Jacobs', 'Jacobson', 'James', 'Jefferson', 'Jenkins', 'Jennings', 'Jensen', 'Jimenez',
    'Johns', 'Johnson', 'Johnston', 'Jones', 'Jordan', 'Joseph', 'Joyce', 'Juarez',
    'Kane', 'Kaufman', 'Keith', 'Keller', 'Kelley', 'Kennedy', 'Kent', 'Kerr', 'Key', 'Khan',
    'Kim', 'King', 'Kirk', 'Klein', 'Kline', 'Knapp', 'Knight', 'Knox', 'Koch', 'Kramer', 'Krause',
    'Lamb', 'Lambert', 'Lancaster', 'Landry', 'Lane', 'Lang', 'Larsen', 'Larson', 'Lawrence',
    'Lawson', 'Le', 'Leach', 'Leblanc', 'Lee', 'Leon', 'Leonard', 'Lester', 'Levine', 'Levy',
    'Lewis', 'Li', 'Lin', 'Lindsay', 'Lindsey', 'Little', 'Liu', 'Livingston', 'Lloyd', 'Logan',
    'Long', 'Lopez', 'Lott', 'Love', 'Lowe', 'Lowery', 'Lucas', 'Luna', 'Lynch', 'Lynn', 'Lyons',
    'Macdonald', 'Macias', 'Mack', 'Madden', 'Maddox', 'Mahoney', 'Maldonado', 'Malone', 'Mann',
    'Manning', 'Marks', 'Marquez', 'Marsh', 'Marshall', 'Martin', 'Martinez', 'Mason', 'Massey',
    'Mathews', 'Mathis', 'Matthews', 'Maxwell', 'May', 'Mayer', 'Mayo', 'Mays', 'McBride',
    'McCarthy', 'McCarty', 'McClain', 'McClure', 'McConnell', 'McCormick', 'McCoy', 'McCullough',
    'McDaniel', 'McDonald', 'McDowell', 'McFarland', 'McGee', 'McGrath', 'McGuire', 'McIntosh',
    'McIntyre', 'McKay', 'McKee', 'McKenzie', 'McKinney', 'McKnight', 'McLaughlin', 'McLean',
    'McLeod', 'McMillan', 'McNeil', 'McPherson', 'Meadows', 'Medina', 'Mejia', 'Melendez',
    'Melton', 'Mendez', 'Mendoza', 'Mercado', 'Mercer', 'Merritt', 'Meyer', 'Meyers', 'Michael',
    'Middleton', 'Miles', 'Miller', 'Mills', 'Miranda', 'Mitchell', 'Molina', 'Monroe', 'Montoya',
    'Moody', 'Moon', 'Moore', 'Mora', 'Morales', 'Moran', 'Moreno', 'Morgan', 'Morris', 'Morrison',
    'Morrow', 'Morse', 'Morton', 'Moses', 'Moss', 'Mueller', 'Mullins', 'Munoz', 'Murphy', 'Murray',
    'Myers',
    'Nash', 'Nava', 'Navarro', 'Neal', 'Nelson', 'Newman', 'Newton', 'Nguyen', 'Nichols', 'Nicholson',
    'Nielsen', 'Nixon', 'Noble', 'Noel', 'Nolan', 'Norman', 'Norris', 'Norton', 'Nunez',
    'Obrien', 'Ochoa', 'Oconnell', 'Oconnor', 'Odom', 'Odonnell', 'Oliver', 'Olsen', 'Olson',
    'ONeal', 'Oneal', 'Ortega', 'Ortiz', 'Osborn', 'Osborne', 'Owen', 'Owens',
    'Pace', 'Pacheco', 'Padilla', 'Page', 'Palmer', 'Park', 'Parker', 'Parks', 'Parrish', 'Parsons',
    'Patel', 'Patrick', 'Patterson', 'Patton', 'Paul', 'Payne', 'Pearce', 'Pearson', 'Peck',
    'Pena', 'Pennington', 'Perez', 'Perkins', 'Perry', 'Peters', 'Petersen', 'Peterson', 'Petty',
    'Phelps', 'Phillips', 'Pierce', 'Pike', 'Pineda', 'Pittman', 'Pitts', 'Pollard', 'Poole',
    'Pope', 'Porter', 'Potter', 'Potts', 'Powell', 'Powers', 'Pratt', 'Preston', 'Price', 'Prince',
    'Proctor', 'Pruitt', 'Pugh', 'Quinn',
    'Ramirez', 'Ramos', 'Ramsey', 'Randall', 'Randolph', 'Rangel', 'Ray', 'Raymond', 'Reed',
    'Reese', 'Reeves', 'Reid', 'Reilly', 'Reyes', 'Reynolds', 'Rhodes', 'Rice', 'Rich', 'Richard',
    'Richards', 'Richardson', 'Richmond', 'Riddle', 'Riggs', 'Riley', 'Rios', 'Rivas', 'Rivera',
    'Rivers', 'Roach', 'Robbins', 'Roberson', 'Roberts', 'Robertson', 'Robinson', 'Robles',
    'Rocha', 'Rodgers', 'Rodriguez', 'Rogers', 'Rojas', 'Rollins', 'Roman', 'Romero', 'Rosa',
    'Rosales', 'Rosario', 'Rose', 'Ross', 'Roth', 'Rowe', 'Rowland', 'Roy', 'Ruiz', 'Rush',
    'Russell', 'Russo', 'Rutledge', 'Ryan',
    'Salas', 'Salazar', 'Salinas', 'Sampson', 'Sanchez', 'Sanders', 'Sandoval', 'Sanford',
    'Santiago', 'Santos', 'Saunders', 'Savage', 'Sawyer', 'Schaefer', 'Schmidt', 'Schneider',
    'Schroeder', 'Schultz', 'Schwartz', 'Scott', 'Sears', 'Sellers', 'Serrano', 'Sexton',
    'Shaffer', 'Shannon', 'Sharp', 'Shaw', 'Shelton', 'Shepard', 'Shepherd', 'Sheppard', 'Sherman',
    'Shields', 'Short', 'Silva', 'Simmons', 'Simon', 'Simpson', 'Sims', 'Singh', 'Singleton',
    'Skinner', 'Sloan', 'Small', 'Smith', 'Snyder', 'Solomon', 'Solis', 'Soto', 'Sparks',
    'Spears', 'Spence', 'Spencer', 'Stafford', 'Stanley', 'Stanton', 'Stark', 'Steele', 'Stein',
    'Stephens', 'Stephenson', 'Stevens', 'Stevenson', 'Stewart', 'Stokes', 'Stone', 'Stout',
    'Strickland', 'Strong', 'Stuart', 'Sullivan', 'Summers', 'Sutton', 'Swanson', 'Sweeney', 'Sweet',
    'Tanner', 'Tate', 'Taylor', 'Terrell', 'Terry', 'Thomas', 'Thompson', 'Thornton', 'Tillman',
    'Todd', 'Torres', 'Townsend', 'Tran', 'Travis', 'Trejo', 'Trevino', 'Trujillo', 'Tucker', 'Turner',
    'Tyler', 'Tyson',
    'Underwood', 'Valdez', 'Valencia', 'Valentine', 'Valenzuela', 'Vance', 'Vang', 'Vargas',
    'Vasquez', 'Vaughan', 'Vaughn', 'Vazquez', 'Vega', 'Velasquez', 'Velazquez', 'Villa',
    'Villanueva', 'Villarreal', 'Vincent', 'Vinson',
    'Wade', 'Wagner', 'Walker', 'Wall', 'Wallace', 'Waller', 'Walls', 'Walsh', 'Walter', 'Walters',
    'Walton', 'Wang', 'Ward', 'Ware', 'Warner', 'Warren', 'Washington', 'Waters', 'Watkins',
    'Watson', 'Watts', 'Weaver', 'Webb', 'Weber', 'Webster', 'Weeks', 'Weiss', 'Welch', 'Wells',
    'Werner', 'West', 'Wheeler', 'Whitaker', 'White', 'Whitehead', 'Whitfield', 'Whitley',
    'Whitney', 'Wiggins', 'Wilcox', 'Wilder', 'Wiley', 'Wilkerson', 'Wilkins', 'Wilkinson',
    'William', 'Williams', 'Williamson', 'Willis', 'Wilson', 'Winters', 'Wise', 'Witt', 'Wolf',
    'Wolfe', 'Wong', 'Wood', 'Woodard', 'Woods', 'Woodward', 'Wooten', 'Workman', 'Wright', 'Wu',
    'Wyatt', 'Wynn',
    'Yang', 'Yates', 'York', 'Young', 'Yu',
    'Zamora', 'Zimmerman', 'Zuniga'
  ];

  // 3. Street suffixes and geographic terms
  const streetTerms = [
    'Dr', 'Dr.', 'Drive', 'Ln', 'Ln.', 'Lane', 'Rd', 'Rd.', 'Road', 'St', 'St.', 'Street',
    'Blvd.', 'Boulevard', 'Pkwy', 'Pkwy.', 'Terr', 'Terrace', 'Pl', 'Place', 'Cir', 'Circle',
    'Loop', 'Pass', 'Trail', 'Path', 'Way', 'Walk', 'Run', 'Bend', 'Cove', 'Creek',
    'Valley', 'View', 'Vista', 'Ridge', 'Hills', 'Park', 'Grove', 'Oaks'
  ];

  // 4. Numbered streets not yet tried
  const numberedStreets = [
    '1st', '6th', '7th', '8th', '9th', '10th', '11th', '12th', '13th', '14th', '15th',
    '16th', '17th', '18th', '19th', '20th', '21st', '22nd', '23rd', '24th', '25th',
    'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'
  ];

  // 5. Geographic/neighborhood terms
  const geoTerms = [
    'North', 'South', 'East', 'West', 'Northeast', 'Northwest', 'Southeast', 'Southwest',
    'Lake', 'River', 'Creek', 'Spring', 'Hill', 'Valley', 'Mountain', 'Mesa', 'Canyon',
    'Ranch', 'Farm', 'Field', 'Meadow', 'Prairie', 'Garden', 'Forest', 'Wood', 'Oak', 'Pine',
    'Cedar', 'Elm', 'Maple', 'Willow', 'Cypress', 'Pecan', 'Walnut', 'Cherry', 'Hickory'
  ];

  // 6. Business/entity terms that work (avoid LLC, Inc, LLP, LP)
  const businessTerms = [
    'Group', 'Partners', 'Holdings', 'Ventures', 'Capital', 'Asset', 'Fund', 'Management',
    'Development', 'Properties', 'Realty', 'Real Estate', 'Investments', 'Associates',
    'Company', 'Corporation', 'Enterprises', 'Resources'
  ];

  // 7. Short 2-3 character combinations (high coverage)
  const shortTerms = [
    'Al', 'An', 'Ar', 'As', 'At', 'Ba', 'Be', 'Bi', 'Bo', 'Br', 'Bu', 'By',
    'Ca', 'Ce', 'Ch', 'Ci', 'Cl', 'Co', 'Cr', 'Cu', 'Da', 'De', 'Di', 'Do', 'Dr', 'Du',
    'Ea', 'Ed', 'El', 'Em', 'En', 'Er', 'Es', 'Ev', 'Fa', 'Fe', 'Fi', 'Fl', 'Fo', 'Fr',
    'Ga', 'Ge', 'Gi', 'Gl', 'Go', 'Gr', 'Gu', 'Ha', 'He', 'Hi', 'Ho', 'Hu', 'In', 'Ja',
    'Je', 'Ji', 'Jo', 'Ju', 'Ka', 'Ke', 'Ki', 'Ko', 'Kr', 'La', 'Le', 'Li', 'Lo', 'Lu',
    'Ma', 'Mc', 'Me', 'Mi', 'Mo', 'Mu', 'Na', 'Ne', 'Ni', 'No', 'Ob', 'Ol', 'Or', 'Os',
    'Pa', 'Pe', 'Ph', 'Pi', 'Pl', 'Po', 'Pr', 'Qu', 'Ra', 'Re', 'Ri', 'Ro', 'Ru', 'Sa',
    'Sc', 'Se', 'Sh', 'Si', 'Sk', 'Sl', 'Sm', 'Sn', 'So', 'Sp', 'St', 'Su', 'Sw', 'Ta',
    'Te', 'Th', 'Ti', 'To', 'Tr', 'Tu', 'Un', 'Up', 'Va', 'Ve', 'Vi', 'Vo', 'Wa', 'We',
    'Wh', 'Wi', 'Wo', 'Wr', 'Ya', 'Yo', 'Za', 'Ze', 'Zi', 'Zo', 'Zu'
  ];

  // Collect all potential terms
  const allPotentialTerms = [
    ...fNames, ...kNames, ...nNames, ...eNames, ...vNames, ...oNames, ...yNames, ...zNames,
    ...lastNames, ...streetTerms, ...numberedStreets, ...geoTerms, ...businessTerms, ...shortTerms
  ];

  // Filter out already tried terms
  for (const term of allPotentialTerms) {
    if (!hasBeenTried(term) && terms.length < 500) {
      terms.push(term);
    }
  }

  return terms;
}

async function main() {
  console.log('🚀 Generating 500 Optimized Search Terms');
  console.log('=' .repeat(60));

  // Load existing terms
  await loadAlreadyTriedTerms();

  // Generate optimized terms
  console.log('\n📊 Generating optimized terms based on analysis...');
  const optimizedTerms = generateOptimizedTerms();

  console.log(`\n✅ Generated ${optimizedTerms.length} new optimized search terms`);

  // Save to file
  const outputPath = path.join(__dirname, '../../data/optimized-batch-500.txt');
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, optimizedTerms.join('\n'), 'utf-8');

  console.log(`\n💾 Saved to: ${outputPath}`);
  console.log('\n📈 Term Statistics:');
  console.log(`   - Total new terms: ${optimizedTerms.length}`);
  console.log(`   - Already tried: ${alreadyTriedSet.size}`);

  // Show sample
  console.log('\n🔍 Sample terms (first 20):');
  optimizedTerms.slice(0, 20).forEach((term, idx) => {
    console.log(`   ${idx + 1}. ${term}`);
  });

  console.log('\n✨ Ready to enqueue! Use:');
  console.log(`   npx tsx src/cli/queue-manager.ts add-terms ${outputPath} --priority-level 5`);

  await prisma.$disconnect();
}

main().catch(console.error);
