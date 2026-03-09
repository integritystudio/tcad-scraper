/**
 * Generate and enqueue uncommon first names for TCAD 2025 backfill.
 *
 * At 401K+ properties, common Anglo names are exhausted. Uncommon first names
 * — especially Hispanic, Asian, African, and Middle Eastern names common in
 * Travis County — yield the highest % of genuinely new property records.
 *
 * Filters out already-searched and blacklisted terms (4+ chars required).
 *
 * Usage:
 *   doppler run -- npx tsx src/scripts/enqueue-uncommon-names.ts          # preview
 *   doppler run -- npx tsx src/scripts/enqueue-uncommon-names.ts --enqueue # enqueue
 *   doppler run -- npx tsx src/scripts/enqueue-uncommon-names.ts --limit 50 # cap count
 */

import { prisma } from '../lib/prisma';

const ENQUEUE = process.argv.includes('--enqueue');
const LIMIT = (() => {
  const idx = process.argv.indexOf('--limit');
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : Infinity;
})();

// ── Uncommon first names by origin ──────────────────────────────────────

const HISPANIC_FEMALE = [
  'Aida', 'Aide', 'Alondra', 'Amada', 'Amparo', 'Araceli', 'Aracely',
  'Azucena', 'Beatriz', 'Berenice', 'Blanca', 'Brenda', 'Candelaria',
  'Catalina', 'Cecilia', 'Celia', 'Cielo', 'Citlali', 'Clarisa',
  'Concepcion', 'Consuelo', 'Corina', 'Dalia', 'Daniela', 'Delfina',
  'Dolores', 'Edelmira', 'Eloisa', 'Elvia', 'Elvira', 'Emperatriz',
  'Enriqueta', 'Erendira', 'Esmeralda', 'Esperanza', 'Estela', 'Estrella',
  'Eugenia', 'Eulalia', 'Fabiola', 'Felicita', 'Fernanda', 'Fidela',
  'Flor', 'Francisca', 'Gabriela', 'Genoveva', 'Georgina', 'Geraldina',
  'Gilberta', 'Gisela', 'Gladys', 'Gloria', 'Graciela', 'Griselda',
  'Guadalupe', 'Guillermina', 'Herminia', 'Hortensia', 'Idalia', 'Ileana',
  'Imelda', 'Ines', 'Irma', 'Isabel', 'Isela', 'Itzel', 'Iveth',
  'Ivette', 'Ivonne', 'Janeth', 'Jaqueline', 'Jazmin', 'Jimena',
  'Josefina', 'Juana', 'Juanita', 'Juliana', 'Karina', 'Karla',
  'Leticia', 'Lidia', 'Liliana', 'Lilia', 'Lorena', 'Lourdes', 'Lucia',
  'Lucila', 'Lucinda', 'Luisa', 'Lupita', 'Magdalena', 'Maira',
  'Manuela', 'Marcela', 'Margarita', 'Maricela', 'Marisela', 'Marisol',
  'Marta', 'Mayela', 'Mayra', 'Mercedes', 'Minerva', 'Mirna', 'Mirtha',
  'Monserrat', 'Natividad', 'Nayeli', 'Nelly', 'Nereida', 'Nidia',
  'Noelia', 'Noemi', 'Nohemi', 'Norma', 'Nydia', 'Ofelia', 'Oliva',
  'Oralia', 'Otilia', 'Paloma', 'Paola', 'Patricia', 'Paulina', 'Perla',
  'Pilar', 'Rafaela', 'Ramona', 'Raquel', 'Rebeca', 'Refugio', 'Reina',
  'Remedios', 'Rocio', 'Rosalba', 'Rosalia', 'Rosalinda', 'Rosario',
  'Rosaura', 'Roxana', 'Rufina', 'Sabina', 'Sarai', 'Selena', 'Silvia',
  'Socorro', 'Soledad', 'Sonia', 'Susana', 'Tania', 'Tatiana', 'Teodora',
  'Teresa', 'Tomasa', 'Trinidad', 'Valentina', 'Veronica', 'Violeta',
  'Virginia', 'Xochitl', 'Yadira', 'Yanet', 'Yaneth', 'Yazmin',
  'Yesenia', 'Yolanda', 'Yuridia', 'Zenaida', 'Zoila', 'Zulema',
];

const HISPANIC_MALE = [
  'Abel', 'Abelardo', 'Abraham', 'Adalberto', 'Adan', 'Adolfo', 'Adrian',
  'Agustin', 'Alejandro', 'Alfonso', 'Alfredo', 'Alvaro', 'Amado',
  'Anastacio', 'Andres', 'Angel', 'Anibal', 'Antonio', 'Arcadio',
  'Armando', 'Arnoldo', 'Arnulfo', 'Artemio', 'Arturo', 'Atanacio',
  'Aurelio', 'Baldomero', 'Baltazar', 'Bartolo', 'Benito', 'Bernabe',
  'Bernardo', 'Braulio', 'Camerino', 'Candelario', 'Carlos', 'Catarino',
  'Cayetano', 'Cecilio', 'Celestino', 'Cesar', 'Ciro', 'Clemente',
  'Cornelio', 'Cristian', 'Cristobal', 'Cruz', 'Dagoberto', 'Damian',
  'Dario', 'David', 'Delfino', 'Desiderio', 'Diego', 'Domingo',
  'Donato', 'Edgardo', 'Edmundo', 'Eduardo', 'Efrain', 'Efren',
  'Eleazar', 'Eleuterio', 'Elias', 'Eliseo', 'Emiliano', 'Emilio',
  'Enrique', 'Epifanio', 'Erasmo', 'Ernesto', 'Esteban', 'Eugenio',
  'Eulalio', 'Eusebio', 'Evaristo', 'Ezequiel', 'Fabian', 'Facundo',
  'Federico', 'Felipe', 'Fermin', 'Fernando', 'Fidel', 'Filemon',
  'Filiberto', 'Flavio', 'Florentino', 'Francisco', 'Fredy', 'Gabino',
  'Gael', 'Genaro', 'Gerardo', 'German', 'Gilberto', 'Gonzalo',
  'Gregorio', 'Guadalupe', 'Guillermo', 'Gustavo', 'Heriberto', 'Hernan',
  'Hilario', 'Hipolito', 'Homero', 'Horacio', 'Hugo', 'Humberto',
  'Ignacio', 'Inocencio', 'Isaias', 'Isidro', 'Ismael', 'Israel',
  'Ivan', 'Jacinto', 'Jacobo', 'Jaime', 'Jairo', 'Javier', 'Jeremiah',
  'Jesus', 'Joaquin', 'Joel', 'Jorge', 'Jose', 'Josue', 'Juan',
  'Julio', 'Juventino', 'Lazaro', 'Leandro', 'Leonardo', 'Leonel',
  'Leopoldo', 'Lorenzo', 'Luciano', 'Luis', 'Manuel', 'Marcelo',
  'Marcos', 'Margarito', 'Mario', 'Martin', 'Mateo', 'Matias',
  'Mauricio', 'Mauro', 'Maximino', 'Miguel', 'Moises', 'Narciso',
  'Natalio', 'Natividad', 'Neftali', 'Nestor', 'Nicolas', 'Noe',
  'Norberto', 'Octavio', 'Omar', 'Orlando', 'Oscar', 'Osbaldo',
  'Osvaldo', 'Ovidio', 'Pablo', 'Panfilo', 'Pascual', 'Patricio',
  'Paulo', 'Pedro', 'Perfecto', 'Porfirio', 'Rafael', 'Ramiro',
  'Ramon', 'Raul', 'Raymundo', 'Refugio', 'Rene', 'Reyes', 'Reynaldo',
  'Ricardo', 'Rigoberto', 'Roberto', 'Rodolfo', 'Rodrigo', 'Rogelio',
  'Rolando', 'Roman', 'Roque', 'Rosario', 'Ruben', 'Rufino', 'Salvador',
  'Samuel', 'Santiago', 'Santos', 'Saul', 'Sebastian', 'Serafin',
  'Sergio', 'Silvestre', 'Simon', 'Socorro', 'Teodoro', 'Tomas',
  'Trinidad', 'Ubaldo', 'Ulises', 'Valentin', 'Vicente', 'Victor',
  'Virgilio', 'Vladimir', 'Wenceslao', 'Xavier', 'Yair',
];

const SOUTH_ASIAN = [
  // Female
  'Aarti', 'Aditi', 'Amala', 'Amita', 'Ananya', 'Anita', 'Anusha',
  'Aruna', 'Ashwini', 'Bhavna', 'Bindu', 'Chandra', 'Chitra', 'Deepa',
  'Deepika', 'Devika', 'Disha', 'Divya', 'Durga', 'Gauri', 'Geeta',
  'Gita', 'Harini', 'Hema', 'Indira', 'Jaya', 'Jayanti', 'Jyoti',
  'Kamala', 'Kalpana', 'Kavita', 'Kavya', 'Kiran', 'Kirti', 'Komal',
  'Lakshmi', 'Lalita', 'Lata', 'Laxmi', 'Leela', 'Madhu', 'Mala',
  'Malini', 'Mamta', 'Manisha', 'Meena', 'Meera', 'Mina', 'Mira',
  'Mohini', 'Nalini', 'Namita', 'Nandini', 'Neelam', 'Neeta', 'Neha',
  'Nila', 'Nirmala', 'Nisha', 'Nita', 'Padma', 'Pallavi', 'Parvati',
  'Pooja', 'Poonam', 'Prachi', 'Pragya', 'Pratima', 'Preeti', 'Priti',
  'Priya', 'Puja', 'Pushpa', 'Rachna', 'Radha', 'Raji', 'Rani',
  'Rashmi', 'Ratna', 'Reema', 'Rekha', 'Renu', 'Rima', 'Rina',
  'Ritu', 'Rohini', 'Ruchi', 'Rukmini', 'Sadhana', 'Sandhya', 'Sangita',
  'Sarita', 'Saroja', 'Savita', 'Seema', 'Shakti', 'Shanti', 'Shashi',
  'Sheela', 'Shilpa', 'Shobha', 'Shruti', 'Sita', 'Smita', 'Sneha',
  'Sonali', 'Sudha', 'Sujata', 'Sulochana', 'Suma', 'Sunita', 'Surbhi',
  'Sushma', 'Swati', 'Tanvi', 'Tara', 'Tulsi', 'Uma', 'Usha',
  'Vandana', 'Varsha', 'Veena', 'Vidya', 'Vimala', 'Vinita',
  // Male
  'Aakash', 'Aditya', 'Ajay', 'Akash', 'Akhil', 'Amar', 'Amrit',
  'Anand', 'Anil', 'Anish', 'Anurag', 'Aravind', 'Arjun', 'Arun',
  'Ashish', 'Ashok', 'Ashwin', 'Balaji', 'Bala', 'Bharat', 'Bhaskar',
  'Chetan', 'Deepak', 'Devendra', 'Deven', 'Dhruv', 'Dilip', 'Dinesh',
  'Ganesh', 'Gaurav', 'Girish', 'Gopal', 'Govind', 'Hari', 'Harish',
  'Hemant', 'Hitesh', 'Jagdish', 'Jayesh', 'Kailash', 'Kamal', 'Karan',
  'Karthik', 'Kiran', 'Kishore', 'Krishna', 'Kumar', 'Lalit', 'Lokesh',
  'Madhav', 'Manoj', 'Mohan', 'Mukesh', 'Murali', 'Nagaraj', 'Nandan',
  'Naresh', 'Naveen', 'Nikhil', 'Nitin', 'Pankaj', 'Paras', 'Pavan',
  'Prabhu', 'Pradeep', 'Prakash', 'Prasad', 'Pravin', 'Rahul', 'Rajeev',
  'Rajendra', 'Rajesh', 'Rajiv', 'Rajan', 'Rakesh', 'Ramesh', 'Ranjit',
  'Ravi', 'Rishi', 'Rohit', 'Sachin', 'Sagar', 'Sameer', 'Sandip',
  'Sanjay', 'Sanjeev', 'Santosh', 'Satish', 'Shankar', 'Shekhar',
  'Shivam', 'Shyam', 'Siddharth', 'Subhash', 'Sudhir', 'Suhas',
  'Sunil', 'Suraj', 'Suresh', 'Tushar', 'Umesh', 'Varun', 'Venkat',
  'Vijay', 'Vikram', 'Vinay', 'Vinod', 'Vipin', 'Vishal', 'Vivek',
];

const EAST_ASIAN = [
  // Chinese
  'Bingwen', 'Changming', 'Chenwei', 'Chunhua', 'Daiyu', 'Fanglin',
  'Guowei', 'Haifeng', 'Haiyan', 'Huiling', 'Jianhua', 'Jiaying',
  'Jingyi', 'Junwei', 'Lanying', 'Lianhua', 'Lingling', 'Meifeng',
  'Mingyu', 'Peilan', 'Qiang', 'Qiong', 'Ruoxi', 'Shuang', 'Tingting',
  'Weilin', 'Xiaoling', 'Xiaoming', 'Xinyi', 'Xuemei', 'Yanling',
  'Yifan', 'Yiming', 'Yuming', 'Zhiwei', 'Zixin',
  // Korean
  'Boyoung', 'Chungha', 'Eunji', 'Haeun', 'Hyejin', 'Hyunji', 'Jieun',
  'Jihye', 'Jinae', 'Jisoo', 'Jiyeon', 'Minji', 'Minjoo', 'Minseo',
  'Seonghwa', 'Seoyeon', 'Soojin', 'Soyeon', 'Sumin', 'Sunhee',
  'Yejin', 'Yoojin', 'Yuna', 'Yunhee',
  // Vietnamese
  'Bichnga', 'Diemmy', 'Haianh', 'Hoainam', 'Huongthu', 'Khanh',
  'Lananh', 'Minhchau', 'Ngoclan', 'Phuclong', 'Quynhanh', 'Thanhha',
  'Thienkim', 'Thuytrang', 'Tuananh', 'Vananh',
];

const MIDDLE_EASTERN_AFRICAN = [
  // Arabic / Middle Eastern
  'Aaliyah', 'Abdalla', 'Abdallah', 'Abdel', 'Abdelrahman', 'Abdulaziz',
  'Abdullah', 'Adnan', 'Ahmad', 'Ahmed', 'Aisha', 'Amal', 'Amina',
  'Amira', 'Amir', 'Anwar', 'Asma', 'Bassam', 'Bilal', 'Dalia',
  'Farah', 'Farid', 'Farida', 'Fatima', 'Fayez', 'Firas', 'Habib',
  'Hadi', 'Hafsa', 'Hamid', 'Hamza', 'Hana', 'Hani', 'Hassan',
  'Heba', 'Huda', 'Hussein', 'Ibrahim', 'Iman', 'Imran', 'Ismail',
  'Jamal', 'Jamila', 'Kamal', 'Kareem', 'Khalid', 'Khalil', 'Laila',
  'Leila', 'Lina', 'Maha', 'Mahdi', 'Mahmoud', 'Majid', 'Malik',
  'Mariam', 'Maryam', 'Mohamed', 'Mohammad', 'Mohammed', 'Mona',
  'Mostafa', 'Mourad', 'Moustafa', 'Munir', 'Mustafa', 'Nabil',
  'Nada', 'Nadia', 'Nadim', 'Nadir', 'Nahla', 'Naima', 'Najat',
  'Nasir', 'Nasser', 'Nizar', 'Noor', 'Noura', 'Omar', 'Omran',
  'Ossama', 'Rami', 'Rania', 'Rashid', 'Reem', 'Riad', 'Rima',
  'Saad', 'Sabrina', 'Sahar', 'Said', 'Saif', 'Salah', 'Salim',
  'Salma', 'Samer', 'Samia', 'Samir', 'Sana', 'Sara', 'Selim',
  'Shadi', 'Sharif', 'Siham', 'Souad', 'Suhail', 'Sultan', 'Taher',
  'Talal', 'Tarek', 'Tariq', 'Wael', 'Walid', 'Wafa', 'Yasser',
  'Yasmin', 'Yousef', 'Youssef', 'Zahra', 'Zaid', 'Zainab', 'Zaki',
  // African
  'Abena', 'Adaeze', 'Adaora', 'Amadi', 'Chidi', 'Chika', 'Chioma',
  'Emeka', 'Folake', 'Ifeanyi', 'Ifeoma', 'Kemi', 'Kwame', 'Ngozi',
  'Nneka', 'Nnamdi', 'Obioma', 'Oluchi', 'Olusegun', 'Sekou', 'Tunde',
  'Uche', 'Yinka', 'Zuberi',
];


async function main() {
  // Load already-searched terms
  const [analyticsRows, propTermRows] = await Promise.all([
    prisma.searchTermAnalytics.findMany({ select: { searchTerm: true } }),
    prisma.property.groupBy({
      by: ['searchTerm'],
      where: { year: 2025, searchTerm: { not: null } },
    }),
  ]);

  const searched = new Set<string>();
  for (const r of analyticsRows) searched.add(r.searchTerm.toLowerCase());
  for (const r of propTermRows) {
    if (r.searchTerm) searched.add(r.searchTerm.toLowerCase());
  }

  // Load blacklist
  const blacklisted = await prisma.searchTermAnalytics.findMany({
    where: { successRate: 0, totalSearches: { gte: 3 } },
    select: { searchTerm: true },
  });
  const blacklistSet = new Set(blacklisted.map(b => b.searchTerm.toLowerCase()));

  // Filter: unsearched, not blacklisted, 4+ chars, no shorter prefix already searched
  const hasSearchedPrefix = (term: string): boolean => {
    const lower = term.toLowerCase();
    for (let len = 4; len < lower.length; len++) {
      if (searched.has(lower.slice(0, len))) return true;
    }
    return false;
  };

  const seen = new Set<string>();
  const candidates: Array<{ name: string; origin: string }> = [];

  const origins: Array<[string[], string]> = [
    [HISPANIC_FEMALE, 'Hispanic F'],
    [HISPANIC_MALE, 'Hispanic M'],
    [SOUTH_ASIAN, 'South Asian'],
    [EAST_ASIAN, 'East Asian'],
    [MIDDLE_EASTERN_AFRICAN, 'Mid East/African'],
  ];

  for (const [list, origin] of origins) {
    for (const name of list) {
      const lower = name.toLowerCase();
      if (lower.length < 4) continue;
      if (searched.has(lower)) continue;
      if (blacklistSet.has(lower)) continue;
      if (seen.has(lower)) continue;
      if (hasSearchedPrefix(name)) continue;
      seen.add(lower);
      candidates.push({ name, origin });
    }
  }

  // Apply limit
  const selected = candidates.slice(0, LIMIT);

  // Summary
  const byCat = new Map<string, number>();
  for (const c of selected) {
    byCat.set(c.origin, (byCat.get(c.origin) || 0) + 1);
  }

  console.log(`Already searched: ${searched.size} | Blacklisted: ${blacklistSet.size}`);
  console.log(`Candidates after filtering: ${candidates.length}`);
  console.log(`Selected (limit ${LIMIT === Infinity ? 'none' : LIMIT}): ${selected.length}\n`);
  console.log('By origin:');
  for (const [origin, count] of byCat) {
    console.log(`  ${origin}: ${count}`);
  }

  console.log('\nTerms:');
  for (const c of selected) {
    console.log(`  ${c.name} (${c.origin})`);
  }

  if (ENQUEUE && selected.length > 0) {
    const { scraperQueue } = await import('../queues/scraper.queue');
    console.log(`\nEnqueuing ${selected.length} terms...`);

    for (const { name } of selected) {
      await scraperQueue.add(
        'scrape-properties',
        { searchTerm: name, userId: 'uncommon-names', scheduled: true },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
    }

    console.log(`Enqueued ${selected.length} jobs`);
    await scraperQueue.close();
  }

}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
