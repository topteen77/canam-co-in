/**
 * Countries and cities for contact location dropdowns.
 * City list is shown based on selected country.
 */

export const CONTACT_COUNTRY_OPTIONS: string[] = [
  'India',
  'Canada',
  'USA',
  'UK',
  'Australia',
  'Germany',
  'Ireland',
  'New Zealand',
  'UAE',
  'Singapore',
  'Netherlands',
  'France',
  'Italy',
  'Spain',
  'Malaysia',
  'Philippines',
  'Pakistan',
  'Bangladesh',
  'Sri Lanka',
  'Nepal',
  'Other'
];

export const CITIES_BY_COUNTRY: Record<string, string[]> = {
  India: [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad',
    'Chandigarh', 'Jaipur', 'Lucknow', 'Indore', 'Coimbatore', 'Kochi', 'Nagpur', 'Bhopal',
    'Ludhiana', 'Surat', 'Vadodara', 'Ghaziabad', 'Noida', 'Gurgaon', 'Faridabad', 'Mysore',
    'Thiruvananthapuram', 'Visakhapatnam', 'Mumbai', 'New Delhi', 'Other'
  ],
  Canada: [
    'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Edmonton', 'Ottawa', 'Winnipeg', 'Quebec City',
    'Hamilton', 'Kitchener', 'London', 'Victoria', 'Halifax', 'Oshawa', 'Windsor', 'Saskatoon',
    'Regina', 'Sherbrooke', 'Barrie', 'Kelowna', 'Abbotsford', 'Kingston', 'Trois-Rivières', 'Other'
  ],
  USA: [
    'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio',
    'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus',
    'Charlotte', 'San Francisco', 'Indianapolis', 'Seattle', 'Denver', 'Boston', 'Nashville',
    'Detroit', 'Portland', 'Las Vegas', 'Miami', 'Atlanta', 'Washington DC', 'Other'
  ],
  UK: [
    'London', 'Birmingham', 'Manchester', 'Leeds', 'Glasgow', 'Liverpool', 'Bristol', 'Sheffield',
    'Edinburgh', 'Cardiff', 'Belfast', 'Newcastle', 'Nottingham', 'Southampton', 'Brighton',
    'Leicester', 'Coventry', 'Reading', 'Plymouth', 'Aberdeen', 'York', 'Oxford', 'Cambridge', 'Other'
  ],
  Australia: [
    'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Newcastle', 'Canberra',
    'Sunshine Coast', 'Wollongong', 'Hobart', 'Geelong', 'Townsville', 'Cairns', 'Darwin', 'Other'
  ],
  Germany: [
    'Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart', 'Düsseldorf', 'Dortmund',
    'Essen', 'Leipzig', 'Bremen', 'Dresden', 'Hannover', 'Nuremberg', 'Duisburg', 'Other'
  ],
  Ireland: [
    'Dublin', 'Cork', 'Limerick', 'Galway', 'Waterford', 'Drogheda', 'Dundalk', 'Swords',
    'Bray', 'Navan', 'Ennis', 'Tralee', 'Carlow', 'Kilkenny', 'Other'
  ],
  'New Zealand': [
    'Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Tauranga', 'Napier', 'Dunedin',
    'Palmerston North', 'Nelson', 'Rotorua', 'Whangarei', 'New Plymouth', 'Invercargill', 'Other'
  ],
  UAE: [
    'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain', 'Al Ain', 'Other'
  ],
  Singapore: [
    'Singapore', 'Other'
  ],
  Netherlands: [
    'Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Groningen', 'Tilburg',
    'Almere', 'Breda', 'Nijmegen', 'Haarlem', 'Arnhem', 'Zaanstad', 'Other'
  ],
  France: [
    'Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier',
    'Bordeaux', 'Lille', 'Rennes', 'Reims', 'Saint-Étienne', 'Toulon', 'Grenoble', 'Other'
  ],
  Italy: [
    'Rome', 'Milan', 'Naples', 'Turin', 'Palermo', 'Genoa', 'Bologna', 'Florence',
    'Venice', 'Verona', 'Catania', 'Padua', 'Trieste', 'Brescia', 'Other'
  ],
  Spain: [
    'Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Málaga', 'Murcia', 'Palma',
    'Bilbao', 'Alicante', 'Córdoba', 'Valladolid', 'Vigo', 'Gijón', 'Other'
  ],
  Malaysia: [
    'Kuala Lumpur', 'George Town', 'Ipoh', 'Petaling Jaya', 'Shah Alam', 'Johor Bahru',
    'Malacca City', 'Kuching', 'Kota Kinabalu', 'Alor Setar', 'Kota Bharu', 'Kangar', 'Other'
  ],
  Philippines: [
    'Manila', 'Quezon City', 'Davao City', 'Cebu City', 'Zamboanga City', 'Taguig', 'Antipolo',
    'Pasig', 'Cagayan de Oro', 'Valenzuela', 'Bacoor', 'Las Piñas', 'General Santos', 'Other'
  ],
  Pakistan: [
    'Karachi', 'Lahore', 'Faisalabad', 'Rawalpindi', 'Multan', 'Gujranwala', 'Peshawar',
    'Quetta', 'Islamabad', 'Sialkot', 'Sargodha', 'Bahawalpur', 'Sukkur', 'Other'
  ],
  Bangladesh: [
    'Dhaka', 'Chittagong', 'Khulna', 'Rajshahi', 'Sylhet', 'Barisal', 'Rangpur', 'Mymensingh', 'Other'
  ],
  'Sri Lanka': [
    'Colombo', 'Kandy', 'Galle', 'Jaffna', 'Negombo', 'Anuradhapura', 'Trincomalee', 'Batticaloa', 'Other'
  ],
  Nepal: [
    'Kathmandu', 'Pokhara', 'Lalitpur', 'Bharatpur', 'Biratnagar', 'Birgunj', 'Dharan', 'Other'
  ],
  Other: []
};

/** Get cities for a country; includes existing city if not in list so we don't lose custom values */
export function getCityOptionsForCountry(country: string, existingCity?: string): string[] {
  const list = CITIES_BY_COUNTRY[country] || [];
  const normalized = (existingCity || '').trim();
  if (normalized && !list.includes(normalized)) {
    return [normalized, ...list];
  }
  return list;
}
