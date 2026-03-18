
## -*- coding: cp1250 -*-
##-*- coding: utf-8 -*-
#-*- coding: iso-8859-2 -*-i
import wx
import os
import string
import time
import csv # create CS
import shelve
import xml.etree.ElementTree as ET
import webbrowser
import ctypes # chybové hlášky 

global CWD # přenesení do dalších funkcí
CWD=os.getcwd() # getcvd vrátí adresu  "current working directory"


def CreateCSV(Adresa):
    global CSV, JOB
    try: os.mkdir (Adresa+'\\TISK\\'+JOB)
    except: pass

def ShelveToDict(NazevS,Key):
    VariablesD=shelve.open(CWD +"\\"+NazevS)
    VariablesL=VariablesD[Key]
    VariablesD.close()
    return VariablesL 

def KontrolaDuplicit(JOB,SerieL,PrvniJizd,PocetKS):
        Adresa=ShelveToDict("VarSettings","ADRESA")# načtení společné adresy
        filenamesL=[] #
        D=0
        for dirname, dirnames, filenames in os.walk(Adresa+'\\TISK\\'+JOB): # výpis z adresáře s vygenerovanými soubory dat 
                for file in filenames:
                    if  file.count (".txt")==1:# jen TXT
                       fileL=file.split("_")#[0] #
                       #print ("file1: ",file1[2])
                       #print ("Serie: ", SerieL)
                       file2L=fileL[2].split(",")#první serie
                       #print ("file1: ",fileL)
                       if  SerieL[0]==  file2L[0]:
                           fileL3=int(fileL[3].replace(",",""));
                           #PrvniJizd=int(PrvniJizd.replace(",",""))
                           #print ("42 ",PrvniJizd)
                           if  fileL3 <=  int(PrvniJizd) <= (fileL3+ int (fileL[4].replace(".txt",""))) : D=1
                           else: pass
                       else: print ("Kontrola OK")                
                    else: pass #
        """ KONTROLA ZAPNOUT        
        if D==1:  ctypes.windll.user32.MessageBoxW(0, "Duplicitni zaznam", "Warning message", 1)
        else:pass                        
       """
                #filenamesL.sort()  # seřazení
        #print (filenamesL)
        #TestovaciL=[JOB,SerieS,PrvniJizd,PocetKS]                 
#KontrolaDuplicit()
SetXML={}; Cislovani="ZAP"
def CteniXML(AdresaXML,JOB):
    tree = ET.parse(AdresaXML)
    root = tree.getroot()
    for child in root:
        SetXML[child.tag] = list (child.attrib.values()) #{'...': [.......],  '...': [......]}
    KROK=SetXML[JOB][1]; PocetCnaRoli=SetXML[JOB][2]; CISLIC=SetXML[JOB][3];
    SetXmlL=[KROK,PocetCnaRoli,CISLIC]
    #print ("FixXML: ",SetXmlL)
    return SetXmlL

def CreateVnitro(JOB,PocetKS):
            SetXmlL=CteniXML(CWD+"\\FixSettings.xml",JOB)# načtení fixních dat
            #print (SetXmlL)
            Variab1L=ShelveToDict("VarSettings",JOB)# načtení variabilních dat
            Adresa=ShelveToDict("VarSettings","ADRESA")# načtení společné adresy
            KsVKr=Variab1L[3]; PrvniRole=Variab1L[4]; PrvniJizd=Variab1L[5].replace(" ","").replace(",",""); PROD=Variab1L[6]
            KROK=SetXmlL[0];CISLIC=SetXmlL[2]; SerieL=Variab1L[1];SerieS=",".join(Variab1L[1]);
            PocetCnaRoli=SetXmlL[1] # Fixní  
            CreateCSV(Adresa)
            #print (JOB,SerieL,PrvniRole,PrvniJizd,CISLIC,PROD,PocetCnaRoli,PocetKS)
            PocetVyhozu=int(PocetKS)/int(PROD)
            if (PocetVyhozu)-int(PocetVyhozu)>0: PocetVyhozu=int(PocetVyhozu)+1  # zaokrouhlení nahoru
            print ("Nacteni ",JOB)
            print ("Prvni císlo role:  ",PrvniRole)# První číslo role
            print ("Prvni cislo jizdenky:  ",PrvniJizd)# První číslo role !           
            print ("Pocet kusu: ", PocetKS)
            print ("Pocet vyhozu:  ",PocetVyhozu)
            #SerieS="|"+"|".join(SerieL)+"|"
            print ("Serie:  ", SerieS)
            RowTxt=""; i=0; Row1="";Row2="";Row3="";c2=0
            KontrolaDuplicit(JOB,SerieL,PrvniJizd,PocetKS)
            CSV= open(Adresa+'\\TISK\\CD_Vnitro\\'+JOB+"_"+SerieS+"_"+str(PrvniJizd)+"_"+str(PocetKS)+'.csv', 'wt', newline='') 
            TXT=open(Adresa+'\\TISK\\CD_Vnitro\\'+JOB+"_"+SerieS+"_"+str(PrvniJizd)+"_"+str(PocetKS)+'.txt', 'wt')   
            #zaznam = csv.writer(csvfile, delimiter=';' ,quotechar='"', quoting=csv.QUOTE_ALL)
            zaznam = csv.writer(CSV)
            w=open(Adresa+'\\TISK\\CD_Vnitro\\'+JOB+"_"+SerieS+"_"+str(PrvniJizd)+"_"+str(PocetKS)+'.txt', 'a') # zápis TXT
            TTF1="FONT_11"; TTF2 = "FONT_12" #"|"
            PocHlav=6 #Pevný počet hlav
            
            print ("PocetKS: ", PocetKS)
            print ("PocetCnaRoli: ", PocetCnaRoli)
            print ("PocetVyhozu: ", PocetVyhozu)
            print ("PrvniJizd: ", PrvniJizd)
            #print ("Cislo0Jizd: ", Cislo0Jizd)
            
            for vyhoz in range (1, int(PocetVyhozu)):
                if Cislovani=="VYP": CisloRole=0 # výroba vzorků
                else:CisloRole=int (PrvniJizd)+int(vyhoz)-1
                #print ("CisloRole: ", CisloRole)                
                for  zc in range (0, 6):# Zaváděcí část role 4 x
                    for  p in range (0, PocHlav): # pevný počet hlav
                            #Row1=Row1 +"NEPRODEJNÉ"+" " +str(SerieL[p])+" "+ str(Cislo0Jizd)+";"
                            Row1=Row1 +"NEPRODEJNE "+";" +str(SerieL[p])+" "+ str(CisloRole)+";"                        
                    Row1 = Row1+";"+str(vyhoz)+";"+str(0)+";"+TTF1                   
                    zaznam.writerow([Row1]);TXT.write (Row1+"\n") ;  Row1=""                
                
                for CisloJizd in range (1, int(PocetCnaRoli)+1):                    
                    CisloRoleF=(("{:0>"+ str(3)+"d}").format(CisloRole))
                    CisloJizdF= (("{:0>"+ str(4)+"d}").format(CisloJizd))
                    if Cislovani=="VYP": Cislo="000"+"  "+CisloJizdF # Vyroba vzorku
                    else: Cislo=CisloRoleF+"  "+CisloJizdF
                    #c3 = str(c3)[:3]+" "+str(c3)[3:] # přidání mezery mezi 3. a 4. znak                    
                    for  p in range (0, PocHlav): # pevný počet hlav
                           Row2=Row2+str(SerieL[p])+""+str(Cislo)+";"+";"
                    Row2 = Row2+";"+str(vyhoz)+";"+str(CisloRoleF)+";"+TTF2           
                    zaznam.writerow([Row2]);TXT.write (Row2+"\n") ;  Row2=""
                    
                print ("Vyhoz:", vyhoz, "CisloRole:",CisloRoleF)                                            
                for  kc in range (0, 4):# Koncová část 6 x 
                    for  p in range (0, PocHlav): # pevný počet hlav                        
                        Row3=Row3 +"NEPRODEJNE"+";"+";" 
                    Row3 = Row3+";"+str(vyhoz)+";"+str(0)+";"+TTF1                   
                    zaznam.writerow([Row3]); TXT.write (Row3+"\n")  ;  Row3=""                     
            CSV.close
            TXT.close
            webbrowser.open(Adresa+'\\TISK\\'+JOB)# otevření složky

def CreateValidator(JOB,PocetKS):
            SetXmlL=CteniXML(CWD+"\\FixSettings.xml",JOB)# načtení fixních dat
            #print (SetXmlL)
            Variab1L=ShelveToDict("VarSettings",JOB)# načtení variabilních dat
            Adresa=ShelveToDict("VarSettings","ADRESA")# načtení společné adresy
            KsVKr=Variab1L[3]; PrvniRole=Variab1L[4]; PrvniJizd=Variab1L[5].replace(" ","").replace(",",""); PROD=Variab1L[6]
            KROK=SetXmlL[0];CISLIC=SetXmlL[2]; SerieL=Variab1L[1];SerieS=",".join(Variab1L[1]);
            PocetCnaRoli=SetXmlL[1] # Fixní  
            CreateCSV(Adresa)
            #print (JOB,SerieL,PrvniRole,PrvniJizd,CISLIC,PROD,PocetCnaRoli,PocetKS)
            PocetVyhozu=int(PocetKS)/int(PROD)
            if (PocetVyhozu)-int(PocetVyhozu)>0: PocetVyhozu=int(PocetVyhozu)+1  # zaokrouhlení nahoru
            print ("Nacteni ",JOB)
            print ("Prvni císlo role:  ",PrvniRole)# První číslo role
            print ("Prvni cislo jizdenky:  ",PrvniJizd)# První číslo role !           
            print ("Pocet kusu: ", PocetKS)
            print ("Pocet vyhozu:  ",PocetVyhozu)
            #SerieS="|"+"|".join(SerieL)+"|"
            print ("Serie:  ", SerieS)
            RowTxt=""; i=0; Row1="";Row2="";Row3="";c2=0
            KontrolaDuplicit(JOB,SerieL,PrvniJizd,PocetKS)
            CSV= open(Adresa+'\\TISK\\CD_Validator\\'+JOB+"_"+SerieS+"_"+str(PrvniJizd)+"_"+str(PocetKS)+'.csv', 'wt', newline='') 
            TXT=open(Adresa+'\\TISK\\CD_Validator\\'+JOB+"_"+SerieS+"_"+str(PrvniJizd)+"_"+str(PocetKS)+'.txt', 'wt')   
            #zaznam = csv.writer(csvfile, delimiter=';' ,quotechar='"', quoting=csv.QUOTE_ALL)
            zaznam = csv.writer(CSV)
            w=open(Adresa+'\\TISK\\CD_Validator\\'+JOB+"_"+SerieS+"_"+str(PrvniJizd)+"_"+str(PocetKS)+'.txt', 'a') # zápis TXT
            TTF1="FONT_11"; TTF2 = "FONT_12" #"|"
            PocHlav=6 #Pevný počet hlav
            
            print ("PocetKS: ", PocetKS)
            print ("PocetCnaRoli: ", PocetCnaRoli)
            print ("PocetVyhozu: ", PocetVyhozu)
            print ("PrvniJizd: ", PrvniJizd)
            #print ("Cislo0Jizd: ", Cislo0Jizd)
            
            for vyhoz in range (1, int(PocetVyhozu)):
                if Cislovani=="VYP": CisloRole=0 # výroba vzorků
                else:CisloRole=int (PrvniJizd)+int(vyhoz)-1
                #print ("CisloRole: ", CisloRole)                
                for  zc in range (0, 6):# Zaváděcí část role 6 x
                    for  p in range (0, PocHlav): # pevný počet hlav
                            #Row1=Row1 +"NEPRODEJNÉ"+" " +str(SerieL[p])+" "+ str(Cislo0Jizd)+";"
                            Row1=Row1 +"NEPRODEJNE "+";" +str(SerieL[p])+" "+ str(CisloRole)+";"                        
                    Row1 = Row1+";"+str(vyhoz)+";"+str(0)+";"+TTF1                   
                    zaznam.writerow([Row1]);TXT.write (Row1+"\n") ;  Row1=""                
                
                for CisloJizd in range (1, int(PocetCnaRoli)+1):
                    CisloRoleF=(("{:0>"+ str(3)+"d}").format(CisloRole))
                    CisloJizdF= (("{:0>"+ str(4)+"d}").format(CisloJizd))
                    if Cislovani=="VYP": Cislo="000"+"  "+CisloJizdF# Vyroba vzorku
                    else: Cislo=CisloRoleF+"  "+CisloJizdF
                    #c3 = str(c3)[:3]+" "+str(c3)[3:] # přidání mezery mezi 3. a 4. znak                    
                    for  p in range (0, PocHlav): # pevný počet hlav
                           Row2=Row2+str(SerieL[p])+""+str(Cislo)+";"+";"
                    Row2 = Row2+";"+str(vyhoz)+";"+str(CisloRoleF)+";"+TTF2           
                    zaznam.writerow([Row2]);TXT.write (Row2+"\n") ;  Row2=""
                    
                print ("Vyhoz:", vyhoz, "CisloRole:",CisloRoleF)                                            
                for  kc in range (0, 4):# Koncová část 4 x 
                    for  p in range (0, PocHlav): # pevný počet hlav                        
                        Row3=Row3 +"NEPRODEJNE"+";"+";" 
                    Row3 = Row3+";"+str(vyhoz)+";"+str(0)+";"+TTF1                   
                    zaznam.writerow([Row3]); TXT.write (Row3+"\n")  ;  Row3=""                     
            CSV.close
            TXT.close
            webbrowser.open(Adresa+'\\TISK\\'+JOB)# otevření složky

def CreatePOP(JOB,PocetKS):
            SetXmlL=CteniXML(CWD+"\\FixSettings.xml",JOB)# načtení fixních dat
            Variab1L=ShelveToDict("VarSettings",JOB) # načtení variabilních dat
            Adresa=ShelveToDict("VarSettings","ADRESA")# načtení společné adresy
            SerieL=Variab1L[1];SerieS=",".join(Variab1L[1]);
            KsVKr=Variab1L[3].replace(",",""); #PrvniRole=Variab1L[4].replace(",","");
            PrvniJizd=(Variab1L[5]).replace(",",""); PROD=Variab1L[6].replace(",","")         
            KROK=SetXmlL[0]; CISLIC=SetXmlL[0];
            PocetCnaRoli=Variab1L[2]# Variabilní
            PrvniRole=int(PrvniJizd)/int(PocetCnaRoli)
            #print ("PocetKS ", PocetKS);print (PROD)
            #print (Adresa,JOB,SerieL,PrvniRole,PrvniJizd,CISLIC,PROD,PocetCnaRoli,PocetKS)
            PocetVyhozu=int(PocetKS)/int(PROD)
            if (PocetVyhozu)-int(PocetVyhozu)>0: PocetVyhozu=int(PocetVyhozu)+1  # zaokrouhlení nahoru
            #print (JOB)
            print ("Prvni cislo jizdenky:  ",PrvniJizd)# První číslo role
            print ("Odpovidající císlo role:  ",PrvniRole)# První číslo role           
            print ("Pocet kusu: ", PocetKS)
            print ("Pocet vyhozu:  ",PocetVyhozu)
            print ("Serie:  ", SerieS)
            RowTxt=""; i=0; Row1="";Row2="";Row3="";c2=0
            KontrolaDuplicit(JOB,SerieL,PrvniJizd,PocetKS) 
            CSV= open(Adresa+'\\TISK\\CD_POP\\'+JOB+"_"+SerieS+"_"+str(PrvniJizd)+"_"+str(PocetKS)+'.csv', 'wt', newline='') 
            TXT=open(Adresa+'\\TISK\\CD_POP\\'+JOB+"_"+SerieS+"_"+str(PrvniJizd)+"_"+str(PocetKS)+'.txt', 'wt')   
            #zaznam = csv.writer(csvfile, delimiter=';' ,quotechar='"', quoting=csv.QUOTE_ALL)
            zaznam = csv.writer(CSV)
            w=open(Adresa+'\\TISK\\CD_POP\\'+JOB+"_"+SerieS+"_"+str(PrvniJizd)+"_"+str(PocetKS)+'.txt', 'a') # zápis TXT
            TTF1="FONT_11"; TTF2 = "FONT_12" #"|"
            #PocHlav=6 #Pevný počet hlav

            for vyhoz in range (1, int(PocetVyhozu)+1):
                #print ("PrvniJizd. ",PrvniJizd)
                Cislo0Jizd=int(PrvniJizd)+(vyhoz-1)*int(PocetCnaRoli) #Cislo 1. jízdenky = číslo role
                print ("Vyhoz:", vyhoz, " ... č. role:",int (PrvniRole)+vyhoz-1)
                for  zc in range (0, 1):# Zaváděcí část _1 x
                    for  p in range (0, len (SerieL)): # 
                        Row1=Row1 +str(SerieL[p])+";" # Pouze písmena serie v zaváděcí části
                    Row1 = Row1+";"+str(vyhoz)+";"+str(0)+";"+TTF1  + ";"+str(int(PrvniRole)+vyhoz) +  "_"+ str((int(PrvniRole)+vyhoz)*len (SerieL))            
                    zaznam.writerow([Row1]);TXT.write (Row1+"\n") ;  Row1=""
                for  c1 in range (0, int(PocetCnaRoli)):# cyklus cislovani jízdenek
                    c3=str(Cislo0Jizd+c1).zfill(int(CISLIC)+2); ## průběžné číslování
                    for  p in range (0, len (SerieL)): # 
                        Row2=Row2+str(SerieL[p])+" "+str(c3)+";"
                    Row2 = Row2+";"+str(vyhoz)+";"+str(c1+1)+";"+TTF2
                    zaznam.writerow([Row2]);TXT.write (Row2+"\n")  ;  Row2="" 
            CSV.close
            TXT.close
            #print (Adresa+'\\TISK')
            webbrowser.open(Adresa+'\\TISK\\'+JOB)# otevření složky
            
def CreateNEXGO(JOB,PocetKS):
            SetXmlL=CteniXML(CWD+"\\FixSettings.xml",JOB)# načtení fixních dat
            Variab1L=ShelveToDict("VarSettings",JOB) # načtení variabilních dat
            Adresa=ShelveToDict("VarSettings","ADRESA")# načtení společné adresy
            SerieL=Variab1L[1];SerieS=",".join(Variab1L[1]);
            KsVKr=Variab1L[3].replace(",",""); #PrvniRole=Variab1L[4].replace(",","");
            PrvniJizd=(Variab1L[5]).replace(",",""); PROD=Variab1L[6].replace(",","")         
            KROK=SetXmlL[0]; CISLIC=SetXmlL[0];
            PocetCnaRoli=SetXmlL[1]          
            PrvniRole=int(PrvniJizd)/int(PocetCnaRoli)
            #print ("PocetKS ", PocetKS);print (PROD)
            print (Adresa,JOB,SerieL,PrvniRole,PrvniJizd,CISLIC,PROD,PocetCnaRoli,PocetKS)
            PocetVyhozu=int(PocetKS)/int(PROD)
            if (PocetVyhozu)-int(PocetVyhozu)>0: PocetVyhozu=int(PocetVyhozu)+1  # zaokrouhlení nahoru
            #print (JOB)
            print ("Prvni cislo jizdenky:  ",PrvniJizd)# První číslo role
            print ("Odpovidající císlo role:  ",PrvniRole)# První číslo role           
            print ("Pocet kusu: ", PocetKS)
            print ("Pocet vyhozu:  ",PocetVyhozu)
            print ("Serie:  ", SerieS)
            RowTxt=""; i=0; Row1="";Row2="";Row3="";c2=0
            KontrolaDuplicit(JOB,SerieL,PrvniJizd,PocetKS) 
            CSV= open(Adresa+'\\TISK\\CD_POP_NEXGO\\'+JOB+"_"+SerieS+"_"+str(PrvniJizd)+"_"+str(PocetKS)+'.csv', 'wt', newline='') 
            TXT=open(Adresa+'\\TISK\\CD_POP_NEXGO\\'+JOB+"_"+SerieS+"_"+str(PrvniJizd)+"_"+str(PocetKS)+'.txt', 'wt')   
            #zaznam = csv.writer(csvfile, delimiter=';' ,quotechar='"', quoting=csv.QUOTE_ALL)
            zaznam = csv.writer(CSV)
            w=open(Adresa+'\\TISK\\CD_POP_NEXGO\\'+JOB+"_"+SerieS+"_"+str(PrvniJizd)+"_"+str(PocetKS)+'.txt', 'a') # zápis TXT
            TTF1="FONT_11"; TTF2 = "FONT_12" #"|"
            #PocHlav=6 #Pevný počet hlav
            d=0
            for vyhoz in range (1, int(PocetVyhozu)+1):
                #print ("PrvniJizd. ",PrvniJizd)
                Cislo0Jizd=int(PrvniJizd)+(vyhoz-1)*int(PocetCnaRoli) #Cislo 1. jízdenky = číslo role
        
                print ("Vyhoz:", vyhoz, " / Role:",vyhoz *len(SerieL))
                for  zc in range (0, 1):# Zaváděcí část _1 x
                    for  p in range (0, len (SerieL)): # 
                        Row1=Row1 +str(SerieL[p])+";" # Pouze písmena serie v zaváděcí části
                    Row1 = Row1+";"+str(vyhoz)+";"+str(0)+";"+TTF1  + ";"+str(int(PrvniRole)+vyhoz) +  "_"+ str((int(PrvniRole)+vyhoz)*len (SerieL))            
                    zaznam.writerow([Row1]);TXT.write (Row1+"\n") ;  Row1=""
                    
                    
                for  c1 in range (0, int(PocetCnaRoli)):# cyklus cislovani jízdenek
                    #c3=str(Cislo0Jizd+c1).zfill(int(CISLIC)+2); ## průběžné číslování
                    c3=(Cislo0Jizd+c1); ## průběžné číslování

                    for  p in range (0, len (SerieL)): #  
                        Row2=Row2+str(SerieL[p])+" "+str(c3+(d+p)*int(PocetCnaRoli)).zfill(int(CISLIC)+2)+  ";"
                    Row2 = Row2+";"+str(vyhoz)+";"+str(c1+1)+";"+TTF2
                    zaznam.writerow([Row2]);TXT.write (Row2+"\n")  ;  Row2=""
                d=vyhoz*(p)
                #print ("d", d)                
            CSV.close
            TXT.close
            #print (Adresa+'\\TISK')
            webbrowser.open(Adresa+'\\TISK\\'+JOB)# otevření složky

def CreateDPB_AVJ(JOB,PocetKS):
            SetXmlL=CteniXML(CWD+"\\FixSettings.xml",JOB)# načtení fixních dat
            Variab1L=ShelveToDict("VarSettings",JOB)# načtení variabilních dat
            Adresa=ShelveToDict("VarSettings","ADRESA")# načtení společné adresy
            SerieL=Variab1L[1];SerieS=",".join(Variab1L[1]);
            KsVKr=Variab1L[3].replace(",",""); PrvniRole=Variab1L[5].replace(",","");
            #PrvniJizd=(Variab1L[5]).replace(",","");
            PROD=Variab1L[6].replace(",","")
            KROK=SetXmlL[0];CISLIC=SetXmlL[0];
            PocetCnaRoli=SetXmlL[1] # Fixní
            #print ("PocetKS ", PocetKS);print (PROD)
            #print (Adresa,JOB,SerieL,PrvniRole,PrvniJizd,CISLIC,PROD,PocetCnaRoli,PocetKS)
            PocetVyhozu=int(PocetKS)/int(PROD)
            if (PocetVyhozu)-int(PocetVyhozu)>0: PocetVyhozu=int(PocetVyhozu)+1  # zaokrouhlení nahoru
            #print (JOB)
            print ("Prvni císlo role:  ",PrvniRole)# První číslo role
            #print ("Prvni cislo role:  ",PrvniJizd)# První číslo role            
            print ("Pocet kusu: ", PocetKS)
            print ("Pocet vyhozu:  ",PocetVyhozu)
            print ("Serie:  ", SerieS)
            RowTxt=""; i=0; Row1="";Row2="";Row3="";Row4="";c2=0
            CSV= open(Adresa+'\\TISK\\DPB_AVJ\\'+JOB+"_"+SerieS+"_"+str(PrvniRole)+"_"+str(PocetKS)+'.csv', 'wt', newline='')            
            TXT=open(Adresa+'\\TISK\\DPB_AVJ\\'+JOB+"_"+SerieS+"_"+str(PrvniRole)+"_"+str(PocetKS)+'.txt', 'wt')   
            zaznam = csv.writer(CSV)
            w=open(Adresa+'\\TISK\\CD_POP\\'+JOB+"_"+SerieS+"_"+str(PrvniRole)+"_"+str(PocetKS)+'.txt', 'a') # zápis TXT
            TTF1="FONT_11"; TTF2 = "FONT_12" #"|"

            Skip=int(Variab1L[7])
            print ("Skip: ",Skip)
            SkipPocitany=int(PocetKS)/int(PROD); # kontrola skipu

            if 0.9 <(abs(float(SkipPocitany)/float(Skip))) <1.1: print ("   Skip OK") # kontrola skipu
            else:
                    print ("!   Máš blbě vypočtený skip")
                    print ("Zadaný/vypočtený skip:", Skip, "/", SkipPocitany)
                    ctypes.windll.user32.MessageBoxW(0, "Máš blbě vypočtený skip", "Warning message", 1)
                    
            #print ("198  ",Skip)
            for vyhoz in range (1, int(PocetVyhozu)+1):# cyklus cislovani rolí
                for  i in range (0, 14): # # zaváděcí pás = 14 čísel
                    for  p in range (0, len (SerieL)): #
                        #print (int(PrvniRole))
                        b3=str((p*(Skip)+(int(PrvniRole)-1)+vyhoz)).zfill(int(4))                    
                        #Row1=Row1 +"NEPREDAJNE"+"_"+(str(SerieL[p])+"  "+(b3))+";"# s písmenem serie
                        Row1=Row1 +"NEPREDAJNE"+" "+(b3)+";"  # bez písmene serie                     
                    Row1 = Row1+";"+str(vyhoz)+";"+str(0)+";"+TTF1  + ";"+str(int(PrvniRole)+vyhoz) +  "_"+ str((int(PrvniRole)+vyhoz)*len (SerieL))  
                    zaznam.writerow([Row1]);TXT.write (Row1+6*";" +"\n") ;  Row1="" 
                #zaznam.writerow([Row1]);TXT.write (Row1+"\n") ;  Row1=""
                print ("Vyhoz č: ",vyhoz)
                
                for  c1 in range (0, int(PocetCnaRoli)):# cyklus cislovani jízdenek
                    c3=str(c1+1).zfill(int(CISLIC)); ## opakující se číslování od 1 do 3600
                    for  p in range (0, len (SerieL)): #
                        b3=str((p*(Skip)+(int(PrvniRole)-1)+vyhoz)).zfill(int(4))
                        #Row2=Row2+str(SerieL[p])+" "+(b3)+"/"+str(c3)+";"
                        Row2=Row2+(b3)+"/"+str(c3)+";"# Bez písmene serie                        
                        #modulo=str ("%.3f" % ((int(b3)+22)/(int(c3)+35)))[-2:-1] # !  # čislo role/číslo jízdenky z toho 2. místo za des. čárkou                   
                        mod1=((str(b3)+str(c3))[::-1])# !  # reversed text
                        mod2=(int(b3)+int(c3))
                        mod3=str(int(mod1)/int(mod2)).split(".")[0]
                        modulo=str(mod3)[-1]
                        #for mod1 in (str(b3)+str(c3)):
                        #modulo = int mod1
                        #if p==0: print(modulo,"  ", mod1,"/",mod2,"=",mod3)
                        #else: pass
                        #print("%.2f" %  modulo)
                        if (p+1) < len (SerieL):
                            Row3=Row3 +modulo+";"  # odstranění středníku u na konci celého řádku ( na vyžádání  Dana Štěpána)
                        else: Row3=Row3 +modulo  # modulo
                        
                    Row2 = Row2+";"+str(vyhoz)+";"+str(c1+1)+";"+TTF2+";"+";"+Row3
                    zaznam.writerow([Row2]);TXT.write (Row2+"\n")  ;  Row2="";Row3=""
            
            for  i in range (0, 300): ##  výběh přidání 300 ks na konec dat   
                    for  p in range (0, len (SerieL)): # 
                        Row4=Row4+ "ZACATEK"+";"  #  přidání 300 ks na konec dat
                    zaznam.writerow([Row4]);TXT.write (Row4+6*";"+"\n") ;  Row4=""
            CSV.close
            TXT.close

def CreateIGT_Sazka(JOB,PocetPredcisli):
    SetXmlL = CteniXML(CWD + "\\FixSettings.xml", JOB)  # načtení fixních dat
    # print (SetXmlL)
    Variab1L = ShelveToDict("VarSettings", JOB)  # načtení variabilních dat
    Adresa = ShelveToDict("VarSettings", "ADRESA")  # načtení společné adresy
    #KsVKr = Variab1L[3];
    PrvniRole = Variab1L[4];
    PrvniJizd = Variab1L[5].replace(" ", "").replace(",", "");
    PROD = Variab1L[6]
    #KROK = SetXmlL[0];
    #CISLIC = SetXmlL[2];
    SerieL = Variab1L[1]; SerieS = ",".join(Variab1L[1]);
    PredcisliL = Variab1L[8];   PredcisliS = ",".join(Variab1L[8]);
    PocetCnaRoli = SetXmlL[1]  # Fixní
    #CreateCSV(Adresa)
    # print (JOB,SerieL,PrvniRole,PrvniJizd,CISLIC,PROD,PocetCnaRoli,PocetPredcisli)
    PocetVyhozu = int(PocetPredcisli) / int(PROD)
    if (PocetVyhozu) - int(PocetVyhozu) > 0: PocetVyhozu = int(PocetVyhozu) + 1  # zaokrouhlení nahoru
    #print("Nacteni ", JOB)
    print("Prvni císlo role:  ", PrvniRole)  # První číslo role
    print("Prvni cislo jizdenky:  ", PrvniJizd)  # První číslo role !
    print("Pocet predčíslí: ", PocetPredcisli) # běžně je toto počet rolí
    print("Pocet vyhozu:  ", PocetVyhozu)
    # SerieS="|"+"|".join(SerieL)+"|"
    print("Serie:  ", SerieS)
    print("Predcisli:  ", PredcisliS)
    RowTxt = "";  i = 0;  Row1 = "";   Row2 = "";  Row3 = "";  c2 = 0
    KontrolaDuplicit(JOB, SerieL, PrvniJizd, PocetPredcisli)
    #CSV = open(Adresa + '\\TISK\\IGT_Sazka\\' + JOB + "_" + SerieS + "_" + str(PrvniJizd) + "_" + str(PocetKS) + '.csv', 'wt', newline='')
    TXT = open(Adresa + '\\TISK\\IGT_Sazka\\' + JOB + "_" + SerieS + "_" + str(PrvniJizd) + "_" + str(PocetPredcisli) + '.txt', 'wt')
    w = open(Adresa + '\\TISK\\IGT_Sazka\\' + JOB + "_" + SerieS + "_" + str(PrvniJizd) + "_" + str(PocetPredcisli) + '.txt', 'a')  # zápis TXT
    TTF1 = "FONT_11";
    TTF2 = "FONT_12"  # "|"
    PocHlav = 6  # Pevný počet hlav
    print("Pocet č. na roli: ", PocetCnaRoli); print()
    #for vyhoz in range(1, int(PocetVyhozu)):
        #CisloRole = int(PrvniJizd) + int(vyhoz) - 1
        # print ("CisloRole: ", CisloRole)
    #print ();  input("Press Enter to continue...") #
        #print ("počet", int(int(PocetKS)/6)*3283)
    Predcisli3=0
    print ("PocetPredcisli", PocetPredcisli)
    A= int(int(PocetPredcisli)/(int(PROD))) # počet vvhozů
    B =float(int(PocetPredcisli) / (int(PROD)))

    Cykl6=  max(1, int(A/10)) #min. 1 cyklus 10 předčíslí...
    if  (A-B)==0: # aby počet předčíslí  byl dělitelný počtem produkcí beze zbytku
        for s in range(0, Cykl6):  # = výhozy děleno 10 - protože následuje cyklus od 1 do 10
        #or s in range(0, int(A/10)):  # = výhozy děleno 10 - protože následuje cyklus od 1 do 10
                #for r in range(0, Cykl10 ):
                for r in range(0, 10):  # cyklus 10. Pak se mění systém předčíslí
                    for PoradCislo in range(1, 999999):
                        for p in range(0, PocHlav):
                            Predcisli2=(int(Predcisli3)+int(PredcisliL[p]) + r)
                            Predcisli2F = ("{:0>3d}".format(Predcisli2))
                            if (len(Predcisli2F)) > 3:   print(), input("!  Předčíslí je větší než 999 !") # zastavení
                            PoradCisloF=("{:0>6d}".format(PoradCislo))
                            Row2 = Row2+ SerieL[p] +"_"+ Predcisli2F+"_"+str(PoradCisloF)+"|"
                                #Predcisli2F+" "+PoradCislo+"|"
                                #Row2 = Row2 + str(Predcisli2F+";"+str(PoradCislo)) + "|"
                        #Row2 = Row2 + "\n"
                        #zaznam.writerow([Row2]);
                        TXT.write(Row2 + "\n");
                        if PoradCislo==1: print(Row2, " ", (r+1)*int(PROD),".")
                        Row2=""
                Predcisli3=Predcisli2+1
                print ("KONEC")
                #print(Row2)
                #Row2=""
    else: print (), print ("! Množství předčíslí není dělitelné počtem produkcí")

    #CSV.close
    TXT.close

    #PrvniJizd2=PrvniRole-Skip*((PROD-1)-k)-1
######################################
class MyPanel(wx.Panel):
     def __init__(self, parent,id,JOB):
        wx.Panel.__init__(self, parent, id)
        #self.SetBackgroundColour(wx.Colour(15,255,204)) # definování barvy pozadí panelu v RGB
        self.SetBackgroundColour(wx.Colour("Sea Green")) # definování barvy pozadí panelu v RGB
        self.SetFont(wx.Font(8, wx.SWISS, wx.NORMAL, wx.NORMAL, False, u'Verdana'));
        self.SetForegroundColour(wx.Colour("White"))
###############################NASTAVENI
        #global xvp,yvp,xc,yc
        xvp=20;   yvp=35
        self.Text1 = wx.StaticText  ( label='Job', name='job', parent=self, pos=wx.Point(xvp+7, yvp), size=wx.Size(83, 16), style=0)
        #self.Text1.SetFont(wx.Font(8, wx.SWISS, wx.NORMAL, wx.NORMAL, False, u'Verdana')); self.Text1.SetForegroundColour(wx.Colour(0, 0, 0))
        self.Text1 = wx.StaticText  ( label=JOB, name='sken', parent=self, pos=wx.Point(xvp+95, yvp), size=wx.Size(150, 16), style=0)
        yvp=yvp+40
        self.Text1 = wx.StaticText  ( label='Poč. předčislí', name='sken', parent=self, pos=wx.Point(xvp+7, yvp+7), size=wx.Size(83, 16), style=0)
        #self.Text1.SetFont(wx.Font(8, wx.SWISS, wx.NORMAL, wx.NORMAL, False, u'Verdana')); self.Text1.SetForegroundColour(wx.Colour(0, 0, 0))
        self.PolePocet= wx.TextCtrl(name=u'Sfield1', parent=self, pos=wx.Point(xvp+95, yvp),size=wx.Size(150,31), style=wx.TE_LEFT,value="60" ,validator=wx.DefaultValidator,id=-1)
        self.PolePocet.SetFont(wx.Font(12, wx.SWISS, wx.NORMAL, wx.NORMAL, False, u'Verdana'))
        self.PolePocet.SetToolTip("1 série = 960 předčíslí = cca 292 400 rolí\nMinimum je 6 x 10 = 60 předčíslí")
        yvp=yvp+40
        self.Text1 = wx.StaticText  ( label='Vzorky', name='sken', parent=self, pos=wx.Point(xvp+7, yvp), size=wx.Size(83, 16), style=0)
        self.cb1 = wx.CheckBox(self, -1, " vypnout cislovani",pos=wx.Point(xvp+95, yvp),style=wx.ALIGN_LEFT) 
        self.Bind(wx.EVT_CHECKBOX, self.funkceCheckBox1, self.cb1)
        yvp=yvp+40
        self.ButtonGener = wx.Button(self, -1, label="OK", pos=wx.Point(xvp+95, yvp+15), size=wx.Size(55, 25)) #Button(  ,  ,Nápis,souřadnice,velikost)
        #self.ButtonGener.Bind(wx.EVT_BUTTON, self.ButtonOK(JOB))#lambda event: self.ButtonOK(event))
        self.ButtonGener.Bind(wx.EVT_BUTTON, lambda event: self.ButtonOK(event,JOB))
         
     def ButtonOK(self,event,JOB):
            PocetKS=self.PolePocet.GetValue()
            #print(JOB, " PocetKS: ", PocetKS)
            if JOB=="CD_Vnitro": CreateVnitro(JOB,PocetKS)
               #print  ("CD_Vnitro - PocetKS:", PocetKS);  #PocetVyhozu =int(PocetKS)/int(PROD)
            elif JOB=="CD_Validator":  CreateValidator(JOB,PocetKS)
            elif JOB=="CD_POP": CreatePOP(JOB,PocetKS)
                #PocetVyhozu =int(PocetKS)/int(PROD)
                #print  ("CD_POP -PocetKS:",PocetKS);  #PocetVyhozu =int(PocetKS)/int(PROD)
            elif JOB=="CD_POP_NEXGO": CreateNEXGO(JOB,PocetKS)
                #PocetVyhozu =int(PocetKS)/int(PROD)
                #print  ("CD_POP -PocetKS:",PocetKS);  #PocetVyhozu =int(PocetKS)/int(PROD)
            elif JOB=="DPB_AVJ": CreateDPB_AVJ(JOB,PocetKS)
                #PocetVyhozu =int(PocetKS)/int(PROD)
                #print  ("DPB_AVJ  PocetKS:",PocetKS);  #PocetVyhozu =int(PocetKS)/int(PROD)
            elif JOB == "IGT_Sazka":   CreateIGT_Sazka(JOB, PocetKS)

            else: pass
            frame1.Destroy()
            #self.Close()
        
     def funkceCheckBox1(self,event):
         global Cislovani
         if self.cb1.GetValue() ==True:  Cislovani="VYP"
         else: Cislovani="ZAP"
         print ("Cislovani "+Cislovani)
         
def Generovani (JOB):
    print (2, (JOB))
    app = wx.App(False)
    global frame1
    frame1 = wx.Frame(None, -1, "ROLE", size = (330,300),pos=(0,0)) #velikost plochy  Whole screen 1030,770
    MyPanel(frame1,-1,JOB)
    #MyPanel(Adresa,JOB,Serie,CisloOD,PocetCnaRoli)
    frame1.Show(True) # okno formuláře je otevřené
    app.MainLoop()

#Generovani( "CD_Vnitro")
#Generovani( "CD_Validator")    
#Generovani( "CD_POP_NEXGO")
#Generovani( "DPB_AVJ")
#Generovani( "IGT_Sazka")
#https://www.himeport.co.jp/python/wxpython-wx-colourdatabase%E3%81%AE%E3%82%B5%E3%83%B3%E3%83%97%E3%83%AB%E8%89%B2%E8%A1%A8%E7%A4%BA%E3%83%97%E3%83%AD%E3%82%B0%E3%83%A9%E3%83%A0/
