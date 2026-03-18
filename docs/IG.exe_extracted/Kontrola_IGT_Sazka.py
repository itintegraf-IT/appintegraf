# -*- coding: utf-8 -*-
##-*- coding: iso-8859-2 -*-i
import wx
import os
#import string
import time
#import csv  # create CS
import shelve  # ukládání do shelf
import shutil  # move file
import xml.etree.ElementTree as ET
import webbrowser  # smazat
import Protokoly_IGT_Sazka
import ctypes  # chybové hlášky
import wx.adv #kalendář
import xml.dom.minidom

global CWD # přenesení do dalších funkcí
CWD = os.getcwd()  # getcvd vrátí adresu  "current working directory"
ctypes.windll.shcore.SetProcessDpiAwareness(2)  # manifest pro správné DPI rozpoznání Pro Windows 8.1+

NT1 = 0  # Defaultni vystup:  0= Nahled PDF A5,A6; 1= Tisk PDF; 2 =Nahled HTML A4,A5; 3=Tisk HTML
NT2 = 0  # Defaultni vystup:  0= Nahled PDF A5,A6; 1= Tisk PDF; 2 =Nahled HTML A4,A5; 3=Tisk HTML
##########################
SetXML = {}; SetXML4 = {};
def CteniXML(AdresaXML, JOB):
    tree = ET.parse(AdresaXML)
    root = tree.getroot()
    for child in root:
        SetXML[child.tag] = list(child.attrib.values())  # {'...': [.......],  '...': [......]}
    KROK = SetXML[JOB][1];
    CiselNaRoli = SetXML[JOB][2];
    CISLIC = SetXML[JOB][3];
    SetXmlL = [KROK, CiselNaRoli, CISLIC]
    #print ("FixXML: ",SetXmlL)
    return SetXmlL


def CreateXML4(SbL, Adresa1):
    import xml.etree.ElementTree as ET
    import xml.dom.minidom

    root = ET.Element("root")

    for kD in SbL:
        for item in kD:
            doc = ET.SubElement(root, item)
            for value in kD[item]:
                elem = ET.SubElement(doc, value[0], name=value[1])
                elem.text = value[2]

    # Krásné formátování
    rough_string = ET.tostring(root, encoding='unicode')
    reparsed = xml.dom.minidom.parseString(rough_string)
    pretty_xml = reparsed.toprettyxml(indent="  ", encoding='utf-8')

    with open(Adresa1, 'wb') as f:
        f.write(pretty_xml)









def CreateXML4(SbL, Adresa1):
    root = ET.Element("root");
    i = 0
    for kD in SbL:  # první cyklus - List
        Ak = kD.keys();  # print (Ak)
        VALUES = kD.values();  # print (VALUES)
        for item in kD:
            # print("Key : {} , Value : {}".format(item,kD[item]))
            # print (item); print (kD[item])
            doc = ET.SubElement(root, item)
            for value in (kD[item]):
                #print (value)
                ET.SubElement(doc, value[0], name=value[1]).text = value[2]
    tree = ET.ElementTree(root)
    tree.write(Adresa1)
    # --- PŘIDANÉ FORMÁTOVÁNÍ ---
    # 1. Převedeme na řetězec
    rough_string = ET.tostring(root, encoding='unicode')

    # 2. Parsujeme a naformátujeme
    reparsed = xml.dom.minidom.parseString(rough_string)
    pretty_xml = reparsed.toprettyxml(indent="  ", encoding='utf-8')

    # 3. Uložíme
    with open(Adresa1, 'wb') as f:
        f.write(pretty_xml)
#CreateXML4([{"Ak1": [("A","Text1","100"),("B","Text2","200")]},{"Ak2":[("C","Text3","300")]}], CWD+'\\PARAMETRY\\XML123.xml')
"""def CteniXML4(Adresa):
    tree = ET.parse(Adresa)
    root = tree.getroot()
    for sub in root:
        for ssub in sub:
            # print (ssub.attrib); print (ssub.text); print (ssub.tag)
            SetXML4[ssub.tag] = list(ssub.attrib.items())
    return SetXML4"""
###################################
def ShelveToDict(NazevS, Key):
    VariablesD = shelve.open(CWD + "\\" + NazevS)
    VariablesL = VariablesD[Key]
    VariablesD.close()
    return VariablesL
def DictToShelve(NazevS, Key, ValuesL):
    VariablesD = shelve.open(CWD + "\\" + NazevS)
    VariablesD[Key] = ValuesL  # uložení MinuleD do shelve "VarSettings"
def Okno(Nazev, Cesta):  # wx File Dialog, vyber souboru
    # Cesta nesmí mít zdublovaná lomítka
    dialog = wx.FileDialog(None, Nazev, Cesta,  style=wx.FD_MULTIPLE | wx.DD_NEW_DIR_BUTTON)
    if dialog.ShowModal() == wx.ID_OK:
        AdresaTXT = dialog.GetPaths()  # ??????
    dialog.Destroy()
    try:
        print(len(AdresaTXT), " Souboru TXT"); print()
        return AdresaTXT
    except:
        print("   !Vyber soubory TXT!")
def Deleni3(line):  # dělení čísel po 3
    i = 1;
    line3 = ""
    for a in line[::-1]:
        if i == 3: a = a + " "; i = 0
        i = i + 1;
        line3 = line3 + a
    line4 = line3[::-1]  # revers
    return (line4)
def NejvyssiCisloKrab(Cesta): # nalezení nejvyššího čísla TXT
    filenamesL = [0]
    for dirname, dirnames, filenames in os.walk(Cesta + "\\TXT"):  # výpis z adresáře "s protokoly"
        for file in filenames:
            if file.count(".txt") == 1:  # jen TXT
                file1 = file.split("_")[0]  #
                filenamesL.append(int(file1))
            else: pass  #
        filenamesL.sort()  # seřazení
        return (filenamesL[-1]) # nejvyšší číslo
def RozprcaneKrabice(JOB):  # načtení rozdělaných a hotových krabic
    global Cesta, SerieL, PredcisliL, KsL, CisloJizdF, PrvniJizdF, CisloJizd, CISLIC,CisloZak
    ######načtení
    KsL = []
    #SetXmlL = CteniXML(CWD + "\\FixSettings.xml", JOB)  # načtení fixních dat
    Variab1L = ShelveToDict("VarSettings", JOB)  # první načtení listu Variables
    Adresa = ShelveToDict("VarSettings", "ADRESA")  # načtení adresy
    SerieL = Variab1L[1];    SerieS = (",".join(SerieL))
    PredcisliL = Variab1L[8];    PredcisliS = (",".join(PredcisliL))
    CISLIC = SetXML[JOB][3]  # počet číslic
    #KsVKr = int(Variab1L[3].replace(",", ""));
    PROD = int(Variab1L[6].replace(",", ""));
    PrvniJizd = int(Variab1L[5].replace(",", "")); PrvniJizdF = str("{:,}".format(PrvniJizd)).replace(",", " ")
    CisloZak= str(ShelveToDict("VarSettings","C_ZAK/IGT_Sazka")) # načtení čísla zak.
    #CiselNaRoli = SetXmlL[1]  # Fixní
    for i in range(PROD):
            KsL.append(0);
            #print ("111", KsL)
    ######
    #RadekL = [];
    j = 0;
    Cesta = (Adresa + '\\REZANI\\' + JOB + "\\")

    CisloJizd1 = int(Variab1L[5].replace(",", "")) + 1;
    CisloJizd = CisloJizd1  # ZADÁNÍ
    CisloJizdHOT = 0;
    CisloJizdOTV_min = CisloJizd1;
    #CisloJizdOTV_PROD = 0  # v případě že nejsou rozpracované aní hotové krabice

    for nazev in os.listdir(Cesta):  # Zjištění počtu otevřených krabic
        if nazev.count(".txt") == 1:  # TXT
            j = j + 1
    if j < PROD and j > 1:  # menší počet TXT souborů než je produkcí=problém
        print("!  Počet TXT neodpovídá počtu podukcí  !")  # TXT soubory neodpovídají počtu sérií (např. první řezání)
        return
    elif j < 1:  # žádný TXT soubor =nová krabice
        print("   Nové krabice ")
        for i in range(0, PROD):  # Počty kusu v krab v jednotl. produkcích  KsL =např [12,1,24,4,4,4]
            TXT = open(Cesta + str(i + 1) + '.txt', 'wt')
            # print ("114: ", PrvniJizdF)
            # CisloJizdF=str("{:,}".format(PrvniJizdF)).replace(","," ")
            CisloJizdF = PrvniJizdF
    else:
        pass
    print()
    j = 0
    for nazev in os.listdir(Cesta):  # NAČTENÍ CISEL Z OTEVŘENÝCH KRABIC..  Počet TXT= počet produkcí
        CisloJizdOTV = 0;
        # print (nazev)
        if nazev.count(".txt") == 1:  # TXT
            with open(Cesta + nazev, "r", encoding="utf-8") as f:  # načtení TXT
                VypisL = f.readlines()  # načtení  obsahu otv. krabic  po řádcích do listu  # print ("138...",VypisL)
            RadekL = []
            for radek in VypisL:
                if radek.count("|") >= 3:
                    RadekL.append(radek)  # Odstranění bordelu
                else:
                    print("!   Máš bordel v datech   !")

            if len(RadekL) >= 1:  # jestliže soubor TXT není prázdný
                PrvniRadekL = RadekL[0].split("|")  # List = první řádek TXT
                PosledniRadekL = RadekL[-1].split("|")  # List = posl. řádek TXT
                KsL[j] = len(RadekL)  # počet kusů rolí=počet řádků
                #print ("163",KsL)
                CisloJizd = int(PosledniRadekL[-2].replace(" ", ""))
                try:
                    SerieL[j] = (PosledniRadekL[-3].replace(" ", ""))  # Kontrola  počtu TXT a série --načteno z posledního řádku
                except:
                    print("!   Počet  TXT musí odpovídat počtu produkcí a sérií !")
                CisloJizdOTV = int(str(CisloJizd).replace(",", " "))  # print ("124...CisloJizd z Otevřené Krab",CisloJizdOTV) #
            j = j + 1;  # print (j)
            if CisloJizdOTV_min > CisloJizdOTV:
                CisloJizdOTV_min = CisloJizdOTV  # CisloJizdOTV_min = nejm. číslo z otevř. krabic (pro ČD)
            else:
                pass
            # print ("129...Nejmensí z Otevřené Krab",CisloJizdOTV_min) #
            if j == PROD:
                CisloJizdOTV_PROD = CisloJizdOTV  # číslo poslední produkce z otevř. krabic (pro DPB)
            else:
                pass  # print ("   Posl. kus v otevřené krabici č.",nazev.replace("txt",""),":    ",CisloJizdOTV, CisloJizdOTV_PROD)
        else:
            pass
    Vypis2 = os.listdir(Cesta + "\\TXT")  # NAČTENÍ POSL ČÍSLA  z HOTOVÝCH KRABIC.
    New = 0;
    TxtLast = 0
    # files = sorted(os.listdir(Cesta+"\\TXT"), key=lambda fn:os.path.getctime(os.path.join(Cesta+"\\TXT", fn[10:])))
    # print (files)
    TxtL = []
    if len(Vypis2) > 0:  # pokud jsou ve složce TXT hotové krabice
        # print (Vypis2)
        # print(sorted (Vypis2))
        for txt in Vypis2:
            # NoTxt=int(txt.split("_")[0])
            tup = (int(txt.split("_")[0]), txt)  # ; print (tup)
            TxtL.append(tup)  # print ("  číslo txt ", NoTxt)  # TxtTime=(os.path.getmtime(Cesta+"\\TXT\\"+txt)) # čas pořízení souboru  # if TxtTime>TxtLast: TxtLast=TxtTime; LastFile=txt # nalezení nejnovějšího souboru TXT  # if NoTxt>TxtLast: TxtLast=NoTxt; LastFile=txt# nalezení nejnovějšího souboru TXT  # print ("   Poslední hotová krabice: ", LastFile)
        TxtL.sort()
        # print (TxtL[-PROD:])
        # LastFile=TxtL[5][1] # pátý soubor txt, celá adresa
        for txt in (TxtL[-PROD:]):
            LastFile = txt[1]
            # print ("TXT: ",LastFile)
            with open(Cesta + "\\TXT\\" + LastFile, "r", encoding="utf-8") as f:  # načtení  nejnovějšího hotového TXT
                RadekL = f.readlines()  # načtení  obsahu rozprac. krabic  po řádcích do listu
            # print ("97.....RadekL: ",RadekL)
            PosledniRadekL = RadekL[-11].split("|")  # 6. záznam odspodu v TXT    !!!!!!! V Případě změny TXT nutno změnit
            #print ("99....PosledniRadekL", PosledniRadekL)
            CisloJizdHOT = int(PosledniRadekL[-2].replace(" ", ""))
            NoTxt = CisloJizdHOT
            if NoTxt > TxtLast: TxtLast = NoTxt;  BigestNo = CisloJizdHOT  # nalezení nejnovějšího souboru TXT  # print  (BigestNo)
    else:
        CisloJizdHOT = 0
    # print(); print ("   Poslední kus v hotové krabici : ",BigestNo)
    # print ("ČD CisloJizdOTV_min",CisloJizdOTV_min)
    if JOB == "IGT_Sazka" :
        if CisloJizdHOT == 0 and CisloJizdOTV_min == 0:
            CisloJizd = CisloJizd1;  # print (1) #  prázdné krabice =nový job
            for i in range(PROD):  KsL.append(0);
            DictToShelve("VarSettings", "PALETA/" + JOB, KsL)  # nový JOB=Nová paleta
        elif CisloJizdHOT == 0 and CisloJizdOTV_min > 0:
            CisloJizdOTV_min;  # print (2)# nejsou hotové, ale jsou rozdělané krab
        elif CisloJizdHOT > 0 and CisloJizdOTV_min == 0:
            CisloJizd = CisloJizdHOT;  # print (3)# nejsou rozdělané, ale jsou jen hotové krab
        elif CisloJizdHOT < CisloJizdOTV_min:
            CisloJizd = CisloJizdHOT;  # print (4) # jsou hotové i rozdělané
        else:
            CisloJizd = CisloJizdOTV_min;  # print (5) # nejmenší číslo je v otevřené. krabici
        print("   Poslední kus v otevřených  krabicích č.:", CisloJizd)
    else:
        pass
    print();
    print("   První nový kus č.:                      ", CisloJizd - 1);
    print()
def TextakSazka (self, Date1,CisloZakazky): # protokol pro IGT
        #CisloZakazky=self.Zakazka.SetValue("");
        ctypes.windll.user32.MessageBoxW(0, "!  Zkontroluj číslo zakázky pro vytvoření sestavy !", "Warning message", 0)
        CisloZakazky = self.Zakazka.GetValue();
        self.Zakazka.SetForegroundColour("Black");
        print ("ShipmentDate: ", Date1); print ()
        print('Vyber (se Shiftem) soubory TXT ze kterých má vzniknout seznam')
        #print("235  ",Cesta)
        #print (str(CisloZakazky))
        CestaTxtL = (Okno("Vyber TXT", Cesta + "TXT"))  # LIst vybraných adres TXT
        RadekTXT1 = "ShipmentDate" + '\t' + "CisloZakazky" + '\t' + "CisloPalety" + '\t' + "CisloKrabice" + '\t' + "CisloRolky" + '\t' + "Serie" + '\t' + "PocatekCislovani" + '\t' + "KonecCislovani"+"\n"
        #print(RadekTXT1)
        with open(Cesta + "Sestavy_IGT\\SESTAVY" + '\\S_'+str(Date1)+'.txt', "w", encoding="utf-8") as f:
            f.write(RadekTXT1)  # poslední záznam
        for CestaTxt in CestaTxtL: # všechny vybrané soubory
            #print ("243", CestaTxt)
            with open(CestaTxt, "r", encoding="utf-8") as f:  # načtení ks z hotových TXT
                VypisL = f.readlines()  # načtení  obsahu TXT po řádcích do listu
                if len(VypisL) > 1:  # eliminace prázdných (nehotových)
                    for sekvence in VypisL: # načtení záznamů
                        if sekvence.count("BALIL") == 1:
                            BALIL = sekvence.replace("BALIL: ", '').replace("\n", '')
                        else:  pass  # BALIL=BALIL.replace("\n", '') #  načteno z paramerů  funkce - tisk rozdělané krabice
                        if sekvence.count("CISLO_KRABICE") == 1:
                            CISLO = sekvence.replace("CISLO_KRABICE:", '').replace("\n", '').replace(" ", "")
                            CISLO=("{:0>7d}".format(int(CISLO)))
                        else: pass
                        if sekvence.count("CISLO_PALETY:") == 1:
                            PALETA = sekvence.replace("CISLO_PALETY: ", '').replace("\n", '').replace(" ", "")
                            PALETA=str("{:0>6d}".format(int(PALETA)))
                            #print (245, PALETA)
                        else:   pass
                    VypisL = [n for n in VypisL if n.count("|") == 3] # ověření záznamu
                    # VypisL.reverse() # převrácení záznamů
                    print()
                    for role in VypisL:
                        role=role.replace("\n","").replace("_",""). replace(" ","")
                        RoleL=role.split("|")
                        #print (RoleL)
                        CisloRolky=str(CISLO+("{:0>3d}".format(int(RoleL[0]))))
                        RadekTXT=str(Date1)+'\t'+str(CisloZakazky)+'\t'+PALETA+'\t'+str(CISLO)+'\t'+CisloRolky+'\t'+RoleL[1]+'\t'+RoleL[3]+'\t'+RoleL[2]
                        #print(RadekTXT)
                        with open(Cesta + "Sestavy_IGT\\SESTAVY\\" + 'S_'+str(Date1)+'.txt', "a", encoding="utf-8") as f: # načtení ks z hotových TXT
                            f.write(RadekTXT +2*"\n")
        wx.Window.Destroy(self.Calendar)
        webbrowser.open(Cesta + "Sestavy_IGT\\SESTAVY\\" + 'S_'+str(Date1)+'.txt')  # zobrazení TXT
Vyhoz = 0;
VyhozF = str("{:,}".format(Vyhoz))
RowTxt = "";
class MyPanel(wx.Panel):
    def __init__(self, parent, id, JOB):
        wx.Panel.__init__(self, parent, id)
        global BarvaOkna1, Font1, BarvaPozadi1, BarvaTextu1, BarvaTextu2, PROD, CiselNaRoli, NT, SerieS, PredcisliS, Korekce, PrvniKrab
        # pro omezení intervalu +/-3
        Font1 = (wx.Font(8, wx.SWISS, wx.NORMAL, wx.BOLD, False, u'Verdana'));
        BarvaOkna1 = wx.Colour(255, 255, 194);
        BarvaPozadi1 = wx.Colour(0, 159, 218);
        #BarvaTextu1 = wx.Colour(0, 38, 100);
        BarvaTextu1 = wx.Colour("black");
        BarvaTextu2 = wx.Colour(0, 129, 210)
        self.SetBackgroundColour(wx.Colour(BarvaPozadi1))  # světlá
        self.SetFont(wx.Font(18, wx.DEFAULT, wx.NORMAL, wx.BOLD, False, u'Arial'));
        self.SetForegroundColour(BarvaTextu1)
        ############################ NACTENI HODNOT
        SetXmlL = CteniXML(CWD + "\\FixSettings.xml", JOB)  # načtení fixních dat
        Variab1L = ShelveToDict("VarSettings", JOB)  # první načtení listu Variables
        SerieL = Variab1L[1]; SerieS = (",".join(SerieL))
        PredcisliL=Variab1L[8]; PredcisliS = (",".join(PredcisliL))
        KsVKr = int(Variab1L[3].replace(",", ""));
        PROD = int(Variab1L[6]);
        Korekce=0
        #try:   Skip = int(Variab1L[7])  # v případě "?"
        #except:  Skip = 0
        # PrvniJizd=int(Variab1L[5].replace(",",""));
        #KROK = SetXmlL[0];
        #CISLIC = SetXmlL[2];
        CiselNaRoli = SetXmlL[1];
        PrvniKrab = int(Variab1L[4])
        ###Načtení počtu hotových krabic
        RozprcaneKrabice(JOB)  # načtení hodnot z rozpracovaných beden
        PrvniJizd = CisloJizd - 1

        # Počet TXT
        PocetTXT = len([f for f in os.listdir(Cesta + "\\TXT") if os.path.isfile(os.path.join(Cesta + "\\TXT", f))])  # ! počet TXT ve složce=počet krabic
        # Nejvyšší číslo TXT
        """
        filenamesL = [0]  # nalezení nejvyššího čísla
        for dirname, dirnames, filenames in os.walk(Cesta+ "\\TXT"):  # výpis z adresáře "s protokoly"
            for file in filenames:
                if file.count(".txt") == 1:  # jen TXT
                    file1 = file.split("_")[0]  #
                    filenamesL.append(int(file1))
                else: pass  #
            filenamesL.sort()  # seřazení
            NejvyssiTXT=(filenamesL[-1])
            #self.PoleCisloOD.SetValue(str(filenamesL[-1]))  #
        """

        # RozprcaneKrabice(JOB)# načtení hodnot z rozpracovaných beden
        ###########################
        xvp1 = 40;  yvp = 30
        self.Text1 = wx.StaticText(label="Job:            " + JOB, name='sken', parent=self, pos=wx.Point(xvp1, yvp), size=wx.Size(83, 20), style=0);
        self.Text1.SetFont(Font1)
        yvp = yvp + 20;
        self.Text1 = wx.StaticText(label="V krabici:   " + str(KsVKr) + " ks", name='sken', parent=self, pos=wx.Point(xvp1, yvp), size=wx.Size(83, 20), style=0);
        self.Text1.SetFont(Font1)
        yvp = yvp + 20;
        self.Text1 = wx.StaticText(label="Výhoz", name='sken', parent=self, pos=wx.Point(xvp1, yvp), size=wx.Size(45, 20), style=0);
        self.Text1.SetFont(Font1)
        xvp2 = xvp1 + 80
        self.Text1 = wx.StaticText(label="Hot. krab.", name='sken', parent=self, pos=wx.Point(xvp2, yvp), size=wx.Size(40, 20), style=0);
        self.Text1.SetFont(Font1)
        xvp3 = xvp2 + 80;
        self.Text1 = wx.StaticText(label="Počet rolí ", name='sken', parent=self, pos=wx.Point(xvp3, yvp), size=wx.Size(40, 20), style=0);
        self.Text1.SetFont(Font1)
        xvp4 = xvp3+80;
        self.Text1 = wx.StaticText(label="Celkem", name='sken', parent=self, pos=wx.Point(xvp4, yvp), size=wx.Size(40, 20), style=0);
        self.Text1.SetFont(Font1)
        yvp = yvp + 20;
        self.Vyhoz = wx.TextCtrl(name=u'Sfield1', parent=self, pos=wx.Point(xvp1, yvp), size=wx.Size(70, 20), style=wx.TE_LEFT, value=VyhozF, validator=wx.DefaultValidator, id=-1);
        self.Vyhoz.SetBackgroundColour(BarvaPozadi1);
        self.Vyhoz.SetFont(Font1)
        # PrvniKrabF = str("{:,}".format(int(PrvniKrab))).replace(",", " ")
        self.Krabice = wx.TextCtrl(name=u'Sfield1', parent=self, pos=wx.Point(xvp2, yvp), size=wx.Size(70, 20), style=wx.TE_LEFT, value=str(NejvyssiCisloKrab(Cesta)), validator=wx.DefaultValidator, id=-1);
        self.Krabice.SetBackgroundColour(BarvaPozadi1);
        self.Krabice.SetFont(Font1)

        self.PocetRoli = wx.TextCtrl(name=u'Sfield1', parent=self, pos=wx.Point(xvp3, yvp), size=wx.Size(70, 20), style=wx.TE_LEFT, value=str(sum(KsL)), validator=wx.DefaultValidator, id=-1);
        self.PocetRoli.SetBackgroundColour(BarvaPozadi1);
        self.PocetRoli.SetFont(Font1)
        self.PocetRoli.SetToolTip("Počet rolí v otevřených krabicích")
        self.RoliCelkem = wx.TextCtrl(name=u'Sfield1', parent=self, pos=wx.Point(xvp4, yvp), size=wx.Size(80, 20), style=wx.TE_LEFT, value=str(sum(KsL) + PocetTXT * KsVKr), validator=wx.DefaultValidator, id=-1);
        self.RoliCelkem.SetBackgroundColour(BarvaPozadi1);
        self.RoliCelkem.SetFont(Font1)
        xvp = 20; yvp = 100
        # self.Box2=wx.StaticBox (self, -1,size=wx.Size(440, 340), pos=wx.Point(xvp-5, yvp), label='')# rámeček
        global CisloJizdOdFL, CisloJizdDoFL
        self.CB = [];
        self.PoleSerie = []; self.PolePredcisli = [];  self.PoleCisloOd = []; self.PoleCisloDo = [];  self.PoleKusy = []; CisloJizdOdFL = []; CisloJizdDoFL= [] #self.SumKrabic = []
        global StartCislaOdL, StartKusyL, StartPalety, Nacteni, StartKrabice,StartPalety, StartCislaDoL
        StartCislaOdL = []; StartCislaDoL = [];  StartKusyL = []; StartKrabice =0;StartPalety=1;

        PrvniJizd = str("{:,}".format(int(PrvniJizd))).replace(",", " ").replace(" ", "") #
        for k in range(0, PROD):  # počet produkcí pevný
            PrvniJizd = str(("{:0>" + str(6) + "d}").format(int(PrvniJizd)));  # 3 místné číslo
            PrvniJizdF=Deleni3(PrvniJizd)
            CisloJizdOdFL.insert(k, PrvniJizdF)  # PrvniJizd=PrvniRole

            PoslJizd = str(("{:0>" + str(3) + "d}").format(int(PrvniJizd)-int(CiselNaRoli)))
            PoslJizdF=Deleni3(PoslJizd)
            CisloJizdDoFL.insert(k, PoslJizdF)  # Poslední jízdenka na první roli

            try: #NAČTENÍ MINULÝCH DAT ze Settings.xml
                Zapis = ((CteniXML4(Cesta + '\\Settings.xml')[SerieL[k]])[0][1])
                ZapisL = str(Zapis).split(",")  #
                #print ("341 ", int((ZapisL[0]).replace(" ","")))
                StartCislaOdL.append(ZapisL[0])
                StartCislaDo=str(int((ZapisL[0]).replace(" ", "")) - int(CiselNaRoli))
                StartCislaDo= ("{:0>6d}".format(int (StartCislaDo))); StartCislaDo=Deleni3(StartCislaDo)
                StartCislaDoL.append(StartCislaDo)
                StartKusyL.append(ZapisL[1].replace("ks", ""))  # kusy rolí v krabicích
                StartKrabice = ZapisL[2]  #
                StartPalety = ZapisL[3].replace(" ", "")
            except: # Settings není k  vytvořený
                StartKusyL = KsL
                StartCislaOdL = CisloJizdOdFL # načítá se z hlavního zadání a proto se fomátuje
                StartCislaDoL = CisloJizdDoFL # načítá se z hlavního zadání a proto se fomátuje
            ################## POLE SÉRIE, Č9SLA A KUSY
            yvp = yvp + 40
            self.CB.append(wx.CheckBox(self, label="", pos=(xvp, yvp + 8)))
            self.Bind(wx.EVT_CHECKBOX, self.funkceCheckBox, self.CB[k]);
            self.CB[k].SetValue(True)
            self.PoleSerie.append(wx.TextCtrl(name=str(k), parent=self, pos=wx.Point(xvp + 25, yvp), size=wx.Size(65, 40), style=wx.TE_CENTRE, value=str(SerieL[k]), validator=wx.DefaultValidator, id=-1))
            #self.PoleSerie[k].SetFont(Font2)
            self.PoleSerie[k].SetBackgroundColour(BarvaOkna1);
            self.PolePredcisli.append(wx.TextCtrl(name=str(k), parent=self, pos=wx.Point(xvp + 91, yvp), size=wx.Size(68, 40), style=wx.TE_CENTRE, value=str(PredcisliL[k]), validator=wx.DefaultValidator, id=-1))
            self.PolePredcisli[k].SetBackgroundColour(BarvaOkna1);
            self.PoleCisloOd.append(wx.TextCtrl(name=str(k), parent=self, pos=wx.Point(xvp + 161, yvp), size=wx.Size(140, 40), style=wx.TE_CENTRE, value=str(StartCislaOdL[k]), validator=wx.DefaultValidator, id=-1))
            self.PoleCisloOd[k].SetBackgroundColour(BarvaOkna1)
            self.PoleCisloDo.append(wx.TextCtrl(name=str(k), parent=self, pos=wx.Point(xvp + 303, yvp), size=wx.Size(140, 40), style=wx.TE_CENTRE, value=str(StartCislaDoL[k]), validator=wx.DefaultValidator, id=-1))
            self.PoleCisloDo[k].SetBackgroundColour(BarvaOkna1)
            self.ButtonMin = wx.Button(self, -1, label="-", pos=wx.Point(xvp+445, yvp ), size=wx.Size(23, 40))
            self.ButtonMin.SetBackgroundColour(BarvaOkna1);  self.ButtonMin.SetForegroundColour("Red")
            self.ButtonMin.Bind(wx.EVT_BUTTON, self.Minus)
            self.ButtonPlus = wx.Button(self, -1, label="+", pos=wx.Point(xvp + 465, yvp), size=wx.Size(23, 40))
            self.ButtonPlus.SetBackgroundColour(BarvaOkna1); self.ButtonPlus.SetForegroundColour("Blue")

            self.ButtonPlus.Bind(wx.EVT_BUTTON, self.Plus)
            self.PoleKusy.append(wx.TextCtrl(name=str(k), parent=self, pos=wx.Point(xvp + 490, yvp), size=wx.Size(86, 40), style=wx.TE_CENTRE, value=str(KsL[k]) + " ks", validator=wx.DefaultValidator, id=-1))
            self.PoleKusy[k].SetBackgroundColour(BarvaOkna1);
            self.PoleKusy[k].SetToolTip("Počet rolí v otevřené krabici")
        yvp=yvp+60;
        self.Text2 = wx.StaticText(label="Počet  krabic na paletě:            ", name='sken', parent=self, pos=wx.Point(xvp1, yvp+15), size=wx.Size(150, 20), style=0);
        self.Text2.SetFont(Font1)
        self.SumKrabic= wx.TextCtrl(name="SumKrabic", parent=self, pos=wx.Point(xvp4-20, yvp), size=wx.Size(105, 30), style=wx.TE_CENTRE, value=str(StartKrabice), validator=wx.DefaultValidator, id=-1)
        self.SumKrabic.SetBackgroundColour(BarvaOkna1);
        self.SumKrabic.SetToolTip('Počet hotových krabic na paletě\nNutno zadat ručně')
        self.SumKrabic.SetFont(wx.Font(15, wx.DEFAULT, wx.NORMAL, wx.BOLD, False, u'Arial'));
        yvp = yvp + 35;
        self.Text2 = wx.StaticText(label="Paleta číslo:            ", name='sken', parent=self, pos=wx.Point(xvp1, yvp+10), size=wx.Size(150, 20), style=0);
        self.Text2.SetFont(Font1)
        self.Paleta= wx.TextCtrl(name="Paleta", parent=self, pos=wx.Point(xvp4-20, yvp), size=wx.Size(105, 30), style=wx.TE_CENTRE, value=str(StartPalety), validator=wx.DefaultValidator, id=-1)
        self.Paleta.SetBackgroundColour(BarvaOkna1);
        self.Paleta.SetToolTip('Číslo rozpracované palety\nZmění se automaticky')
        self.Paleta.SetFont(wx.Font(15, wx.DEFAULT, wx.NORMAL, wx.BOLD, False, u'Arial'));
        yvp = yvp + 35
        self.Text2 = wx.StaticText(label="Číslo zakázky:            ", name='sken', parent=self, pos=wx.Point(xvp1, yvp+10), size=wx.Size(150, 20), style=0);
        self.Text2.SetFont(Font1)
        self.Zakazka= wx.TextCtrl(name="Zakazka", parent=self, pos=wx.Point(xvp4-20, yvp), size=wx.Size(105, 30), style=wx.TE_CENTRE, value=CisloZak, validator=wx.DefaultValidator, id=-1)
        self.Zakazka.SetFont (wx.Font(12, wx.SWISS, wx.NORMAL, wx.BOLD, False, u'Verdana'))
        with open(CWD + "\\Zamestnanci\\Zamestnanci.txt", "r", encoding="utf-8") as f:  # načtení TXT zaměstnanců
            Vypis2L = f.readlines()  # načtení  obsahu po řádcích do listu
        JmenaL = []
        for jmeno in Vypis2L:  JmenaL.append(jmeno)
        # print (JmenaL)
        #########   Combobox Balení
        yvp = yvp + 65
        self.ButtonOpen = wx.Button(self, -1, label="Open", pos=wx.Point(xvp1, yvp), size=wx.Size(70, 25))  # Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonOpen.Bind(wx.EVT_BUTTON, lambda event: self.ButtonNahledTXT(Cesta))
        self.ButtonOpen.SetToolTip("Vstup do databází. \nZde možno ručně opravit zápis")
        self.ButtonOpen.SetBackgroundColour(wx.Colour(BarvaPozadi1));
        self.ButtonOpen.SetFont(wx.Font(10, wx.DEFAULT, wx.NORMAL, wx.BOLD, False, u'Arial'));
        yvp = yvp + 30  # Mimořádný tisk
        self.ButtonPrint = wx.Button(self, -1, label="Jet", pos=wx.Point(xvp1, yvp), size=wx.Size(70, 25))  # Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonPrint.Bind(wx.EVT_BUTTON, lambda event: self.TiskTXT(Cesta))
        self.ButtonPrint.SetToolTip("Znovu tisk štítku")
        self.ButtonPrint.SetBackgroundColour(wx.Colour(BarvaPozadi1));
        self.ButtonPrint.SetFont(wx.Font(10, wx.DEFAULT, wx.NORMAL, wx.BOLD, False, u'Arial'));
        yvp = yvp - 30  # Balení
        self.ComboBalil = wx.ComboBox(self, -1, value="Vyber jmeno...", pos=wx.Point(xvp2, yvp), size=wx.Size(165, 25), choices=JmenaL, style=0, name="Balil")
        self.ComboBalil.SetBackgroundColour(wx.Colour("white"));
        self.ComboBalil.SetFont(wx.Font(10, wx.MODERN, wx.NORMAL, wx.NORMAL, 0, "Arial"))
        self.ComboBalil.Bind(wx.EVT_COMBOBOX, self.ComboBalil1)
        self.ComboBalil.SetFocus()
        xvp5 = xvp4+30;  # Seznam pro ČD
        self.ButtonSeznam = wx.Button(self, -1, label="Sestava", pos=wx.Point(xvp5-20, yvp), size=wx.Size(75, 25))  # Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonSeznam.Bind(wx.EVT_BUTTON, lambda event: self.Seznam(Cesta))
        self.ButtonSeznam.SetToolTip("Vytvoření klientských dat")
        self.ButtonSeznam.SetBackgroundColour(wx.Colour(BarvaPozadi1));
        self.ButtonSeznam.SetFont(wx.Font(10, wx.DEFAULT, wx.NORMAL, wx.BOLD, False, u'Arial'));
        yvp = yvp + 30  # Tisk sestav
        self.Sestava = wx.CheckListBox(self, -1, choices=[" Tisk na jehle", "  Nahled"], pos=wx.Point(xvp2, yvp), size=wx.Size(165, 25), style=0, name="Sestava")
        # self.Sestava.SetFont(wx.Font(11, wx.MODERN, wx.NORMAL, wx.NORMAL, 0,"Arial")); self.Sestava.Check(NT1, check=True)#self.Sestava.SetBackgroundColour(wx.Colour(BarvaPozadi1)) nefunguje
        self.Sestava.SetFont(wx.Font(11, wx.MODERN, wx.NORMAL, wx.NORMAL, 0, "Arial"));
        #self.Sestava.Check(NT1, check=True);  # self.Sestava.Check(NT2, check=True);#self.Sestava.SetBackgroundColour(wx.Colour(BarvaPozadi1)) nefunguje
        self.Sestava.Check(NT2, check=True);  # self.Sestava.Check(NT2, check=True);#self.Sestava.SetBackgroundColour(wx.Colour(BarvaPozadi1)) nefunguje
        #self.Sestava.Check(NT1, check=True);  # self.Sestava.Check(NT2, check=True);#self.Sestava.SetBackgroundColour(wx.Colour(BarvaPozadi1)) nefunguje
        self.Sestava.Bind(wx.EVT_CHECKLISTBOX, self.CLBSestava);
        NT = (NT1, NT2)  # nastavit  pozice stejnou jako True
        self.Sestava.SetToolTip("Výstup: \n- Náhled před tiskem\n- Jenom tisk ")
        # BUTTON Paleta
        self.ButtonPaleta = wx.Button(self, -1, label="Paleta", pos=wx.Point(xvp5-20, yvp), size=wx.Size(75, 25))  # Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonPaleta.Bind(wx.EVT_BUTTON, lambda event: self.Paleta1(Cesta))
        self.ButtonPaleta.SetToolTip("Tisk paletových sestav")
        self.ButtonPaleta.SetBackgroundColour(wx.Colour(BarvaPozadi1));
        self.ButtonPaleta.SetFont(wx.Font(10, wx.DEFAULT, wx.NORMAL, wx.BOLD, False, u'Arial'));
        #Calendar
        xvp=240;  yvp = yvp + 60
        self.ButtonOK1 = wx.Button(self, -1, label="OK", pos=wx.Point(xvp-65, yvp + 15), size=wx.Size(90, 55))  # Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonOK1.Bind(wx.EVT_BUTTON, lambda event: self.ButtonOK(JOB))
        self.ButtonZ1 = wx.Button(self, -1, label="‹", pos=wx.Point(xvp - 100, yvp + 15), size=wx.Size(30, 55))  # Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonZ1.SetToolTip("Zpět o 1")
        self.ButtonZ1.Bind(wx.EVT_BUTTON, lambda event: self.ButtonZP1())
        self.ButtonZ2 = wx.Button(self, -1, label="«", pos=wx.Point(xvp - 130, yvp + 15), size=wx.Size(30, 55))  # Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonZ2.SetToolTip("Zpět o 10")
        self.ButtonZ2.Bind(wx.EVT_BUTTON, lambda event: self.ButtonZP2())
        self.ButtonZ3 = wx.Button(self, -1, label="‹«", pos=wx.Point(xvp - 160, yvp + 15), size=wx.Size(30, 55))  # Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonZ3.SetToolTip("Zpět o 100")
        self.ButtonZ3.Bind(wx.EVT_BUTTON, lambda event: self.ButtonZP3())
        self.ButtonZ4 = wx.Button(self, -1, label="««", pos=wx.Point(xvp - 190, yvp + 15), size=wx.Size(30, 55))  # Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonZ4.SetToolTip("Zpět o 1000")
        self.ButtonZ4.Bind(wx.EVT_BUTTON, lambda event: self.ButtonZP4())

        self.ButtonT1 = wx.Button(self, -1, label="›", pos=wx.Point(xvp + 30, yvp + 15), size=wx.Size(30, 55))  # Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonT1.SetToolTip("Vpřed o 1 cislo")
        self.ButtonT1.Bind(wx.EVT_BUTTON, lambda event: self.ButtonTA1())
        self.ButtonT2 = wx.Button(self, -1, label="»", pos=wx.Point(xvp + 60, yvp + 15), size=wx.Size(30, 55))  # Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonT2.SetToolTip("Vpřed o 10")
        self.ButtonT2.Bind(wx.EVT_BUTTON, lambda event: self.ButtonTA2())
        self.ButtonT3 = wx.Button(self, -1, label="»›", pos=wx.Point(xvp +90, yvp + 15), size=wx.Size(30, 55))  # Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonT3.SetToolTip("Vpřed o 100")
        self.ButtonT3.Bind(wx.EVT_BUTTON, lambda event: self.ButtonTA3())
        self.ButtonT4 = wx.Button(self, -1, label="»»", pos=wx.Point(xvp + 120, yvp + 15), size=wx.Size(30, 55))  # Button(  ,  ,Nápis,souřadnice,velikost)
        self.ButtonT4.SetToolTip("Vpřed 1000")
        self.ButtonT4.Bind(wx.EVT_BUTTON, lambda event: self.ButtonTA4())
        self.CBTurbo = wx.CheckBox(self, -1, label="Turbo", pos=wx.Point(xvp + 180, yvp + 25))  # Button(  ,  ,Nápis,souřadnice,velikost)
        self.CBTurbo.SetToolTip("Po celých protokolech")
        self.CBTurbo.Bind(wx.EVT_CHECKBOX, self.cbTurbo1)
        self.CBTurbo.SetFont(wx.Font(10, wx.DEFAULT, wx.NORMAL, wx.BOLD, False, u'Arial'));  # self.CBTurbo.SetValue(True)  # self.ButtonTurbo.SetBackgroundColour("SEA GREEN"); self.ButtonTurbo.SetFont(wx.Font(12, wx.DEFAULT, wx.NORMAL, wx.BOLD,  False, u'Arial'));                  ####### načtení TXT zaměstnanců
    def CLBSestava(self, event):  # CheckListBox
        global NT
        NT = (self.Sestava.GetCheckedItems())
        #print(NT)  # print ("   Tisk výstup: ", self.Sestava.GetCheckedStrings())
    def TiskTXT(self, Cesta):  # Tisk štítku
        CestaTxtL = (Okno("Vyber TXT", Cesta + "Sestavy_IGT\\INKJETY"))
        #print (NT)# 0=zapnuto
            #print(CestaTxtL)
        for cesta in CestaTxtL:
            #print ("481 ručně", cesta)
                try: Protokoly_IGT_Sazka.Printer.EPSON_FX(cesta)# ZAPNOUT!!!
                except: "!   Zkontroluj připojení k tiskárně nebo typ - EPSON FX-890 ESC/P   !"
    def Paleta1(self, Cesta):
        TxtL = (Okno("Vyber TXT", Cesta + "Sestavy_IGT\\TXT\\"))
        TxtL3=[]
        for Txt in TxtL:
            #Txt.split("\\")[-1]
            TxtL3.append (Txt.split("\\")[-1])
        #print("485", TxtL3)
            # načtení  obsahu TXT po řádcích do listu
        CisloPalety = int(self.Paleta.GetValue())
        CisloZakazky = self.Zakazka.GetValue();
        #print ("491....", CisloZakazky)
        #CisloZakazky = int(CisloZakazky)
        Protokoly_IGT_Sazka.Stitek_Paleta(Cesta, CisloPalety, CisloZakazky,TxtL3)
        #print (Cesta, CisloPalety, CisloZakazky)
    def Seznam(self, Cesta):  # Jen kalendář (nešla vrátit proměnná) Navazuje "TextakSazka
            print("  Dvojklikem zadej datum dodání")
            self.Zakazka.SetForegroundColour("Red"); self.Zakazka.SetSize(105, 29),

            self.Calendar = wx.adv.CalendarCtrl(self, id=10, date=wx.DateTime.Now(), pos=wx.Point(418, 400), size=wx.Size(176, 188), name="Calendar")
            self.Calendar.SetBackgroundColour(wx.Colour(BarvaOkna1))
            self.Calendar.SetToolTip("Dvojklikem zadej datum dodání ")
            self.Calendar.Bind(wx.adv.EVT_CALENDAR, self.OnDate)
    def funkceCheckBox(self, event):
        for k in range(0, PROD):
            if self.CB[k].GetValue() == False:  # nezaškrtnutý
                self.PoleCisloOd[k].SetSize(121, 40);
                self.PoleCisloDo[k].SetSize(121, 40);
                self.PoleKusy[k].SetSize(85, 41);
                self.PoleSerie[k].SetSize(63, 41);
                self.PolePredcisli[k].SetSize(57, 41);
                #self.SumKrabic.SetSize(85, 41);
                self.PoleCisloOd[k].SetBackgroundColour(BarvaPozadi1);
                self.PoleCisloOd[k].SetForegroundColour(BarvaTextu2);
                self.PoleCisloDo[k].SetBackgroundColour(BarvaPozadi1);
                self.PoleCisloDo[k].SetForegroundColour(BarvaTextu2);
                self.PoleSerie[k].SetBackgroundColour(BarvaPozadi1);
                self.PoleSerie[k].SetForegroundColour(BarvaTextu2);
                self.PolePredcisli[k].SetBackgroundColour(BarvaPozadi1);
                self.PolePredcisli[k].SetForegroundColour(BarvaTextu2);
                self.PoleKusy[k].SetBackgroundColour(BarvaPozadi1)
                self.PoleKusy[k].SetForegroundColour(BarvaTextu2)
                #self.SumKrabic.SetBackgroundColour(BarvaPozadi1)
                #self.SumKrabic.SetForegroundColour(BarvaTextu2)
            else:
                self.PoleCisloOd[k].SetSize(120, 40);
                self.PoleCisloDo[k].SetSize(120, 40);
                self.PoleKusy[k].SetSize(85, 40);
                self.PoleSerie[k].SetSize(64, 40);
                self.PolePredcisli[k].SetSize(58, 40);
                #self.SumKrabic.SetSize(85, 40);
                self.PoleCisloOd[k].SetBackgroundColour(BarvaOkna1);
                self.PoleCisloOd[k].SetForegroundColour(BarvaTextu1);
                self.PoleCisloDo[k].SetBackgroundColour(BarvaOkna1);
                self.PoleCisloDo[k].SetForegroundColour(BarvaTextu1);
                self.PoleSerie[k].SetBackgroundColour(BarvaOkna1);
                self.PoleSerie[k].SetForegroundColour(BarvaTextu1);
                self.PolePredcisli[k].SetBackgroundColour(BarvaOkna1);
                self.PolePredcisli[k].SetForegroundColour(BarvaTextu1);
                self.PoleKusy[k].SetBackgroundColour(BarvaOkna1)
                self.PoleKusy[k].SetForegroundColour(BarvaTextu1)
                #self.SumKrabic.SetBackgroundColour(BarvaOkna1)
                #self.SumKrabic.SetForegroundColour(BarvaTextu1)
    def cbTurbo1(self, event):
        if self.CBTurbo.GetValue() == True:
            print("  Po celých krabicích")
        else:
            pass  # Turbo= (event.GetEventObject().GetLabel())   # print (Turbo)
    def ButtonOK(self, JOB):
        CestaTxtL = [];  #RowpolD = {}  # import HTMLProtokol
        global Vyhoz, KsL, RowTxt, Korekce# CKrabNaPaleteL
        SetXmlL = CteniXML(CWD + "\\FixSettings.xml", JOB)  # načtení fixních dat
        Variab1L = ShelveToDict("VarSettings", JOB)  # první načtení listu Variables
        #Adresa = ShelveToDict("VarSettings", "ADRESA")  # načtení adresy
        KsVKr = int(Variab1L[3].replace(",", ""));
        PROD = int(Variab1L[6].replace(",", ""));
        #PrvniJizd = int(Variab1L[5].replace(",", ""));
        Korekce=0;
        if int (self.SumKrabic.GetValue()) >100: # kontrola zadání počtu krabic
            print ("!   Krabic na paletě musí být méně než 100 ks   !")
            ctypes.windll.user32.MessageBoxW(0, "Krabic na paletě musí být méně než 100 ks", "Warning message", 0)
        else: CKrabNaPalete =int (self.SumKrabic.GetValue())
        Balil = self.ComboBalil.GetValue();
        CisloZak=self.Zakazka.GetValue();
        CisloZak=(7-(len (CisloZak)))*"0"+CisloZak # doplnění do 7 míst
        self.Zakazka.SetValue(CisloZak)# doplnění o nulu
        """if Balil=="Vyber jmeno...XXX":  # VYHODIT !!!"""
        if Balil == "Vyber jmeno...":
            print("!   Vyber jméno  !")
            ctypes.windll.user32.MessageBoxW(0, "Vyber jméno ", "Warning message", 0)
        elif CisloZak== "":
            print("!  Zadej číslo zakázky  !")
            ctypes.windll.user32.MessageBoxW(0, "Zadej číslo zakázky", "Warning message", 0)
        else:
            CiselNaRoli = SetXmlL[1]; #CKrabNaPalete = 0
            ###přidat konec krabice
            if self.CBTurbo.GetValue() == True: Cyklus = KsVKr;
            else: Cyklus = 1;  # print (Cyklus)
            for i in range(0, Cyklus):  # počet ks v krab
                Vyhoz = Vyhoz + 1;
                VyhozF = str("{:,}".format(Vyhoz))  # dělení čísel po třech
                print("Vyhoz:", Vyhoz)  # Vyhoz
                self.Vyhoz.SetValue(VyhozF)  # zápis do pole Výhoz
                #RowCsv = str(Vyhoz) + ";"
                for k in range(0, PROD):  # Range je 1 až X-1 !
                    SerieL[k] = self.PoleSerie[k].GetValue() # načtení skutečných serií
                    PredcisliL[k] =self.PolePredcisli[k].GetValue()
                    CisloRole_ZacF = self.PoleCisloOd[k].GetValue();
                    CisloRole_Zacatek = int(CisloRole_ZacF.replace(" ", ""))  # načteno z  polí
                    if self.CB[k].GetValue() == True:  # Checkbox u serie  zaškrtnutý
                        self.PoleKusy[k].SetForegroundColour("black");
                        with open(Cesta + str(k + 1) + ".txt", "r", encoding="utf-8") as f:  # načtení KS z rozdělaných TXT
                            VypisL = f.readlines()  # načtení  obsahu TXT po řádcích do listu
                        RadekL = []
                        for radek in VypisL:
                            if radek.count("|") >= 3:  # vytřídění bordelu
                                RadekL.append(radek)
                        KsL[k] = len(RadekL)  # počet kusů v TXT=počet řádků  =Počty kusu v krab  KsL =např [12,1,24,4,4,4]
                        Ks = ("{:0>2d}".format(KsVKr - KsL[k]))  # formátování pouze pro zápis do TXT

                        CisloRole_Konec=self.PoleCisloDo[k].GetValue().replace(" ", "");
                        #CisloRole_Konec = int(CisloRole_Zacatek) - int(CiselNaRoli) + 1
                        CisloRole_Konec = str.zfill(str(CisloRole_Konec), int(CISLIC))  # doplnení zleva nulama
                        CisloRole_Zacatek = str.zfill(str(CisloRole_Zacatek), int(CISLIC))  # doplnení zleva nulama
                        CisloRole_KonF = Deleni3(str(CisloRole_Konec))
                        CisloRole_ZacF = Deleni3(str(CisloRole_Zacatek))
                        Interval =int(CisloRole_Zacatek) - int(CisloRole_Konec)

                        RowTxt = Ks + "|" + SerieL[k] + "|" +str(PredcisliL[k])+"_"+ str(CisloRole_KonF) + "|" + str(PredcisliL[k])+"_"+ str(CisloRole_ZacF) + "\n"  # zápis záznamu do TXT
                        print(SerieL[k] + " " + PredcisliL[k] + "_" + str(CisloRole_KonF) + " - " + PredcisliL[k] + "_" + str(CisloRole_ZacF)+"  cisel: "+str(Interval));
                        #print (RowTxt )
                        if int(CisloRole_Zacatek) < 1:
                            print("!   Záporná čísla. Blbě zadáno  !")
                            return
                        else:  pass
                        if KsL[k] < (KsVKr - 1):  # ROZDĚLANÁ KRABICE
                            KsL[k] = KsL[k] + 1  # přidání do krabic
                            with open(Cesta + str(k + 1) + '.txt', 'a', encoding="utf-8") as f:
                                f.write(RowTxt)  # další záznam
                        else:  # PLNA KRABICE = přejmenování  txt , a č. Krabice+1
                            named_tuple = time.localtime()  # čas
                            Time = time.strftime("%m/%d/%Y, %H:%M:%S", named_tuple)  # formát času
                            PocetTXT = len([f for f in os.listdir(Cesta + "\\TXT") if os.path.isfile(os.path.join(Cesta + "\\TXT", f))])  # ! počet TXT ve složce=počet krabic
                            #cisl = str(PocetTXT + 1+PrvniKrab).replace(" ", "")
                            #print("....678, Pocet TXT ", PocetTXT, "PrvniKrab ", PrvniKrab, "Soucet", int(PocetTXT) + int(PrvniKrab))
                            #print("....679 Nejvyssí cislo", NejvyssiCisloKrab(Cesta))
                            if NejvyssiCisloKrab(Cesta) == 0: NejvyssiCKrab = PrvniKrab + NejvyssiCisloKrab(Cesta)  # v případě prázdné složky TXT nutno doplnit předchozí krabice
                            else:    NejvyssiCKrab = NejvyssiCisloKrab(Cesta)
                            cisl = str(NejvyssiCKrab+ 1).replace(" ", "") #pro založení prvního souboru TXT
                            #cisl = str(1 + PrvniKrab).replace(" ", "")
                            CisloPalety=int(self.Paleta.GetValue())
                            CKrabNaPalete = int(self.SumKrabic.GetValue()) + 1
                            #if int(self.SumKrabic.GetValue())<=100: # přidání počtu krabic na paletu
                            #else:pass
                            with open(Cesta + str(k + 1) + '.txt', 'a', encoding="utf-8") as f:
                                f.write(RowTxt)  # poslední záznam.
                                if NejvyssiCisloKrab(Cesta)==0: NejvyssiCKrab= PrvniKrab+NejvyssiCisloKrab(Cesta) #v případě prázdné složky TXT nutno doplnit předchozí krabice
                                else:    NejvyssiCKrab= NejvyssiCisloKrab(Cesta)
                                f.write("\nJOB: " + JOB + "\nSERIE: " + SerieL[k] + "\nCISLO_KRABICE: " + str(NejvyssiCKrab+ 1) + "\nPRODUKCE: " + str(k + 1) + "\nCISLO_PALETY: " + str(CisloPalety) + "\nMNOZSTVI: " + str(KsVKr) + " ks" + "\nBALIL: " + Balil + "\nCAS: " + Time)  # doplnění  záznamu o čas, balil...
                            # print (".....Protokol.Nahled", (CestaTxt, KsL,k, PocetTXT,JOB, PrvniKrab,Balil,PROD,[1,1]))
                            # Protokol.Nahled(CestaTxt, KsL,k, SerieL, PocetTXT,JOB, PrvniKrab,Balil,PROD,NT)
                            KsL[k] = 0  # nová krabice (Počet ks=1)
                            #self.Krabice.SetValue(str(PocetTXT + 1))  # zvýšení čísla krabice
                            self.Krabice.SetValue(str(NejvyssiCisloKrab(Cesta)+1))
                            Paleta = 100# počet krabic na paletě
                            if CKrabNaPalete ==Paleta: # HOTOVÁ PALETA aut. změna čísla palety
                                CKrabNaPalete = CKrabNaPalete - Paleta  # snížení počtu krabic o 100
                                self.SumKrabic.SetValue(str(CKrabNaPalete))#
                                CisloPalety=CisloPalety+1 # zvýšení čísla palety
                                self.Paleta.SetValue(str(CisloPalety))
                                  # když má paleta méně než 100 krabic
                                NovyNazev = str(CisloZak) + "_" + str(CisloPalety) + "_" + str(PredcisliL[k]) + '.txt'
                                #shutil.move(Cesta + str(k + 1) + '.txt', Cesta + "\\TXT\\" + str(PocetTXT + 1+PrvniKrab) + "_" + NovyNazev, copy_function=shutil.copytree)  # přehození do adresáře TXT
                                if NejvyssiCisloKrab(Cesta)==0: NejvyssiCKrab= PrvniKrab+NejvyssiCisloKrab(Cesta) #v případě prázdné složky TXT nutno doplnit předchozí krabice
                                else:    NejvyssiCKrab= NejvyssiCisloKrab(Cesta)
                                shutil.move(Cesta + str(k + 1) + '.txt', Cesta + "\\TXT\\" + str(1+NejvyssiCKrab) + "_" + NovyNazev, copy_function=shutil.copytree)  # přehození do adresáře TXT
                                #time.sleep(2)  # Sleep for 2 seconds
                                TxtL = (os.listdir(Cesta + "\\TXT"))  # výpis pro tisk paletového štítku
                                TxtL2 = sorted(TxtL, key=lambda x: int(x.split('_')[0]))  # řazení listu podle prvního splitu
                                #print ("654   ", TxtL2)
                                TxtL2 = TxtL2[-Paleta:]  # omezení na poslední počet záznamů (100 krabic)
                                self.ButtonOK1.Disable() # zákaz  Buttonu než se vytiskne soubor
                                Protokoly_IGT_Sazka.Stitek_Paleta(Cesta, CisloPalety, CisloZak, TxtL2)  # Tisk paletového štítku
                                #time.sleep(0.5)  # Sleep for 1 seconds
                                self.ButtonOK1.Enable()
                                TXT = open(Cesta + str(k + 1) + '.txt', 'wt')  # založení nového  #
                                #time.sleep(2)  # Sleep for 3 seconds
                            else:
                                NovyNazev=str(CisloZak) + "_" + str(CisloPalety) + "_" + str(PredcisliL[k]) + '.txt'
                                #shutil.move(Cesta + str(k + 1) + '.txt', Cesta + "\\TXT\\" + str(PocetTXT + 1) +SerieL[k] +"_" + PredcisliL[k]+ '.txt', copy_function=shutil.copytree)  # přehození do adresáře TXT
                                #time.sleep(0.1)  # Sleep for 3 seconds
                                #shutil.move(Cesta + str(k + 1) + '.txt', Cesta + "\\TXT\\" + str(PocetTXT + 1+PrvniKrab) + "_" +NovyNazev, copy_function=shutil.copytree)  # přehození do adresáře TXT
                                if NejvyssiCisloKrab(Cesta)==0: NejvyssiCKrab= PrvniKrab+NejvyssiCisloKrab(Cesta) #v případě prázdné složky TXT nutno doplnit předchozí krabice
                                else:    NejvyssiCKrab= NejvyssiCisloKrab(Cesta)
                                shutil.move(Cesta + str(k + 1) + '.txt', Cesta + "\\TXT\\" + str(1+NejvyssiCKrab) + "_" +NovyNazev, copy_function=shutil.copytree)  # přehození do adresáře TXT
                                TXT = open(Cesta + str(k + 1) + '.txt', 'wt')  # založení nového
                                #with open(Cesta + "\\TXT\\" + str(PocetTXT + 1) + "_" +NovyNazev, "r", encoding="utf-8") as f:  # načtení TXT
                                    #VypisL2 = f.readlines()  # načtení  obsahu otv. krabic  po řádcích do listu
                                    #TXT = open(Cesta + str(k + 1) + '.txt', 'wt')  # založení nového

                            CestaTxt = Cesta + "\\TXT\\" + cisl + "_" + NovyNazev #
                            self.SumKrabic.SetValue(str(CKrabNaPalete))
                            self.PoleKusy[k].SetForegroundColour("blue");
                            self.PoleCisloOd[k].SetForegroundColour("black")
                            CestaTxtL.append(CestaTxt)  # List TXT k náhledu a tisku

                        #CisloRoleOd2 = int(CisloRole_Zacatek) - int(CiselNaRoli);  # CisloRoleOdF2=str("{:,}".format(CisloRoleOd2)).replace(","," ");#??
                        CisloRoleOd2 = self.PoleCisloDo[k].GetValue().replace(" ", "")
                        CisloRoleOd2=int(CisloRoleOd2) - 1
                        CisloRoleOdF2 = str.zfill(str(CisloRoleOd2), int(CISLIC))  # doplnení zleva nulama
                        CisloRoleOdF2 = Deleni3(CisloRoleOdF2)
                        self.PoleCisloOd[k].SetValue(CisloRoleOdF2);
                        CisloRoleDo2 = (int(CisloRoleOd2) - int(CiselNaRoli));
                        CisloRoleDoF2 = str.zfill(str(CisloRoleDo2), int(CISLIC))
                        CisloRoleDoF2 = Deleni3(CisloRoleDoF2)
                        self.PoleCisloDo[k].SetValue(CisloRoleDoF2);  # ? vyhodit test
                        self.PoleKusy[k].SetValue(str(KsL[k]) + " ks");
                        self.PoleCisloDo[k].SetForegroundColour("black");
                    else:  # Odškrtnutý Checkbox
                        print(" ", SerieL[k], " vyřazeno")
                        CisloRoleOd2 = self.PoleCisloDo[k].GetValue().replace(" ", "")
                        CisloRoleOd2=int(CisloRoleOd2) - 1
                        CisloRoleOdF2 = str.zfill(str(CisloRoleOd2), int(CISLIC))  # doplnení zleva nulama
                        CisloRoleOdF2 = Deleni3(CisloRoleOdF2)
                        self.PoleCisloOd[k].SetValue(CisloRoleOdF2)
                        CisloRoleDo2 = (int(CisloRoleOd2) - int(CiselNaRoli));
                        CisloRoleDoF2 = str.zfill(str(CisloRoleDo2), int(CISLIC))
                        CisloRoleDoF2 = Deleni3(CisloRoleDoF2)
                        self.PoleCisloDo[k].SetValue(CisloRoleDoF2)
                #CisloPalety = int(self.Paleta.GetValue())
                named_tuple = time.localtime()  # čas
                Time  = time.strftime("%m/%d/%Y, %H:%M:%S", named_tuple).replace(",", " ")  # formát času
                #RowCsv = RowCsv + str(" " + Time) + ";"
                self.PocetRoli.SetValue(str(sum(KsL)))  # Aktuální počet rolí
                RolivKrab = int(self.Krabice.GetValue()) * KsVKr;
                self.RoliCelkem.SetValue(str(sum(KsL) + RolivKrab))
                #BALIL = ""  # pro neuplnou krabici.  V příp. úplné se načte z TXT
            #print("690", CisloZak)
            if len(CestaTxtL) >= 1:
                DictToShelve("VarSettings", "PALETA/" + JOB, CKrabNaPalete)
                DictToShelve("VarSettings", "C_ZAK/" + JOB, CisloZak) # uložení č. zak do Shelve
                #Protokoly_IGT_Sazka.Stitek_Krabice(CestaTxtL, Cesta, JOB, BALIL, NT, "OK")  # Create PDF + Uložení
            NestedL = []
            for k in range(0, PROD):  # zápis posl. stavu do XML
                NestedL.append([])
                for j in [SerieL[k], self.PoleCisloOd[k].GetValue() + "," + self.PoleKusy[k].GetValue() + "," + self.SumKrabic.GetValue()+", "+ self.Paleta.GetValue(), " "+ str(k + 1) + ". prod."]:
                    NestedL[k].append(j)
            #print ("887", NestedL)
            SD = ([{"cisla_od": NestedL}, {"balil": [("jmeno", self.ComboBalil.GetValue(), "vyst_kontrola")]}])
            print ("---",SD)
            CreateXML4(SD, Cesta + '\\Settings.xml')
        if len (CestaTxtL)>1: # v případě, že CestaTxtL není prázdný
            """print ("712", str(CestaTxtL)+","+Cesta)"""# pro start  def(Stitek_Krabice) modulu Protokoly
            self.ButtonOK1.Disable()  # zákaz  Buttonu než se vytiskne soubor
            Protokoly_IGT_Sazka.Stitek_Krabice(CestaTxtL, Cesta,NT) #TxtL= 6 hotových krabic, Cesta = cesta k ... \IGT_Sazka\
            self.ButtonOK1.Enable()
        else: pass#
    def Minus (self,event): # Minus 1
        global Korekce
        Skip = 1
        Korekce=Korekce - 1
        print (" Korekce:", Korekce, end = ' ')
        for k in range(0, PROD):
            #print (sum(KorekceL))
            if (Korekce) < -3 or (Korekce) > 3  :
                self.PoleCisloDo[k].SetForegroundColour("Red")
            else:
                self.PoleCisloDo[k].SetForegroundColour("Black")
            CisloRole_KonF = self.PoleCisloDo[k].GetValue()  #
            Role_Konec = CisloRole_KonF.replace(" ", "")
            CisloRoleOd2 = int(Role_Konec) - int(Skip);
            CisloRoleOdF2 = str.zfill(str(CisloRoleOd2), int(CISLIC))  # doplnení zleva nulama
            CisloRoleOdF2 = Deleni3(CisloRoleOdF2)
            self.PoleCisloDo[k].SetValue(CisloRoleOdF2);
            if self.CB[k].GetValue() != True: self.PoleCisloDo[k].SetForegroundColour(BarvaTextu2)
    def Plus(self, event): # Plus 1
        global Korekce
        Skip = 1;
        Korekce=Korekce+1
        print(" Korekce:", Korekce, end = ' ')
        for k in range(0, PROD):
            if (Korekce) < -3 or (Korekce) > 3:
                self.PoleCisloDo[k].SetForegroundColour("Red")
            else: self.PoleCisloDo[k].SetForegroundColour("Black")
            CisloRole_KonF = self.PoleCisloDo[k].GetValue()  #
            Role_Konec = CisloRole_KonF.replace(" ", "")
            CisloRoleOd2 = int(Role_Konec) +  int(Skip);
            CisloRoleOdF2 = str.zfill(str(CisloRoleOd2), int(CISLIC))  # doplnení zleva nulama
            CisloRoleOdF2 = Deleni3(CisloRoleOdF2)
            self.PoleCisloDo[k].SetValue(CisloRoleOdF2);
            if self.CB[k].GetValue() != True: self.PoleCisloDo[k].SetForegroundColour(BarvaTextu2)
    def ButtonZP1(self):  # zpětný posun o 1 krok
        Skip = -1
        for k in range(0, PROD):
            CisloRole_ZacF = self.PoleCisloOd[k].GetValue()  # načteno z první produkce
            CisloRole_Zacatek = CisloRole_ZacF.replace(" ", "")
            CisloRoleOd2 = int(CisloRole_Zacatek) - Skip;
            CisloRoleOdF2 = str.zfill(str(CisloRoleOd2), int(CISLIC))  # doplnení zleva nulama
            CisloRoleOdF2 = Deleni3(CisloRoleOdF2)
            self.PoleCisloOd[k].SetValue(CisloRoleOdF2);
            CisloRole_KonF = self.PoleCisloDo[k].GetValue()  # načteno z první produkce
            CisloRole_Konec = CisloRole_KonF.replace(" ", "")
            CisloRoleDo2 = int(CisloRole_Konec) - Skip;
            CisloRoleDoF2 = str.zfill(str(CisloRoleDo2), int(CISLIC))  # doplnení zleva nulama
            CisloRoleDoF2 = Deleni3(CisloRoleDoF2)
            self.PoleCisloDo[k].SetValue(CisloRoleDoF2);
    def ButtonZP2(self):  # zpětný posun o 10 kroků
        Skip = -10
        for k in range(0, PROD):
            CisloRole_ZacF = self.PoleCisloOd[k].GetValue()  # načteno z první produkce
            CisloRole_Zacatek = CisloRole_ZacF.replace(" ", "")
            CisloRoleOd2 = int(CisloRole_Zacatek) - Skip;
            CisloRoleOdF2 = str.zfill(str(CisloRoleOd2), int(CISLIC))  # doplnení zleva nulama
            CisloRoleOdF2 = Deleni3(CisloRoleOdF2)
            self.PoleCisloOd[k].SetValue(CisloRoleOdF2);
            CisloRole_KonF = self.PoleCisloDo[k].GetValue()  # načteno z první produkce
            CisloRole_Konec = CisloRole_KonF.replace(" ", "")
            CisloRoleDo2 = int(CisloRole_Konec) - Skip;
            CisloRoleDoF2 = str.zfill(str(CisloRoleDo2), int(CISLIC))  # doplnení zleva nulama
            CisloRoleDoF2 = Deleni3(CisloRoleDoF2)
            self.PoleCisloDo[k].SetValue(CisloRoleDoF2);
    def ButtonZP3(self):  # zpětný posun o 10 kroků
        Skip = -100
        for k in range(0, PROD):
            CisloRole_ZacF = self.PoleCisloOd[k].GetValue()  # načteno z první produkce
            CisloRole_Zacatek = CisloRole_ZacF.replace(" ", "")
            CisloRoleOd2 = int(CisloRole_Zacatek) - Skip;
            CisloRoleOdF2 = str.zfill(str(CisloRoleOd2), int(CISLIC))  # doplnení zleva nulama
            CisloRoleOdF2 = Deleni3(CisloRoleOdF2)
            self.PoleCisloOd[k].SetValue(CisloRoleOdF2);
            CisloRole_KonF = self.PoleCisloDo[k].GetValue()  # načteno z první produkce
            CisloRole_Konec = CisloRole_KonF.replace(" ", "")
            CisloRoleDo2 = int(CisloRole_Konec) - Skip;
            CisloRoleDoF2 = str.zfill(str(CisloRoleDo2), int(CISLIC))  # doplnení zleva nulama
            CisloRoleDoF2 = Deleni3(CisloRoleDoF2)
            self.PoleCisloDo[k].SetValue(CisloRoleDoF2);
    def ButtonZP4(self):  # zpětný posun o 10 kroků
        Skip = -1000
        for k in range(0, PROD):
            CisloRole_ZacF = self.PoleCisloOd[k].GetValue()  # načteno z první produkce
            CisloRole_Zacatek = CisloRole_ZacF.replace(" ", "")
            CisloRoleOd2 = int(CisloRole_Zacatek) - Skip;
            CisloRoleOdF2 = str.zfill(str(CisloRoleOd2), int(CISLIC))  # doplnení zleva nulama
            CisloRoleOdF2 = Deleni3(CisloRoleOdF2)
            self.PoleCisloOd[k].SetValue(CisloRoleOdF2);
            CisloRole_KonF = self.PoleCisloDo[k].GetValue()  # načteno z první produkce
            CisloRole_Konec = CisloRole_KonF.replace(" ", "")
            CisloRoleDo2 = int(CisloRole_Konec) - Skip;
            CisloRoleDoF2 = str.zfill(str(CisloRoleDo2), int(CISLIC))  # doplnení zleva nulama
            CisloRoleDoF2 = Deleni3(CisloRoleDoF2)
            self.PoleCisloDo[k].SetValue(CisloRoleDoF2);
    def ButtonTA1(self):  # posun vpřed o  krok
        Skip = +1
        for k in range(0, PROD):
            CisloRole_ZacF = self.PoleCisloOd[k].GetValue()  # načteno z první produkce
            CisloRole_Zacatek = CisloRole_ZacF.replace(" ", "")
            CisloRoleOd2 = int(CisloRole_Zacatek) - Skip;
            CisloRoleOdF2 = str.zfill(str(CisloRoleOd2), int(CISLIC))  # doplnení zleva nulama
            CisloRoleOdF2 = Deleni3(CisloRoleOdF2)
            self.PoleCisloOd[k].SetValue(CisloRoleOdF2);
            CisloRole_KonF = self.PoleCisloDo[k].GetValue()  # načteno z první produkce
            CisloRole_Konec = CisloRole_KonF.replace(" ", "")
            CisloRoleDo2 = int(CisloRole_Konec) - Skip;
            CisloRoleDoF2 = str.zfill(str(CisloRoleDo2), int(CISLIC))  # doplnení zleva nulama
            CisloRoleDoF2 = Deleni3(CisloRoleDoF2)
            self.PoleCisloDo[k].SetValue(CisloRoleDoF2);
    def ButtonTA2(self):  # posun vpřed o 10  kroků
        Skip = +10
        for k in range(0, PROD):
            CisloRole_ZacF = self.PoleCisloOd[k].GetValue()  # načteno z první produkce
            CisloRole_Zacatek = CisloRole_ZacF.replace(" ", "")
            CisloRoleOd2 = int(CisloRole_Zacatek) - Skip;
            CisloRoleOdF2 = str.zfill(str(CisloRoleOd2), int(CISLIC))  # doplnení zleva nulama
            CisloRoleOdF2 = Deleni3(CisloRoleOdF2)
            self.PoleCisloOd[k].SetValue(CisloRoleOdF2);
            CisloRole_KonF = self.PoleCisloDo[k].GetValue()  # načteno z první produkce
            CisloRole_Konec = CisloRole_KonF.replace(" ", "")
            CisloRoleDo2 = int(CisloRole_Konec) - Skip;
            CisloRoleDoF2 = str.zfill(str(CisloRoleDo2), int(CISLIC))  # doplnení zleva nulama
            CisloRoleDoF2 = Deleni3(CisloRoleDoF2)
            self.PoleCisloDo[k].SetValue(CisloRoleDoF2);
    def ButtonTA3 (self):  # posun vpřed o 10  kroků
        Skip = +100
        for k in range(0, PROD):
            CisloRole_ZacF = self.PoleCisloOd[k].GetValue()  # načteno z první produkce
            CisloRole_Zacatek = CisloRole_ZacF.replace(" ", "")
            CisloRoleOd2 = int(CisloRole_Zacatek) - Skip;
            CisloRoleOdF2 = str.zfill(str(CisloRoleOd2), int(CISLIC))  # doplnení zleva nulama
            CisloRoleOdF2 = Deleni3(CisloRoleOdF2)
            self.PoleCisloOd[k].SetValue(CisloRoleOdF2);
            CisloRole_KonF = self.PoleCisloDo[k].GetValue()  # načteno z první produkce
            CisloRole_Konec = CisloRole_KonF.replace(" ", "")
            CisloRoleDo2 = int(CisloRole_Konec) - Skip;
            CisloRoleDoF2 = str.zfill(str(CisloRoleDo2), int(CISLIC))  # doplnení zleva nulama
            CisloRoleDoF2 = Deleni3(CisloRoleDoF2)
            self.PoleCisloDo[k].SetValue(CisloRoleDoF2);
    def ButtonTA4(self):  # posun vpřed o 10  kroků
        Skip = +1000
        for k in range(0, PROD):
            CisloRole_ZacF = self.PoleCisloOd[k].GetValue()  # načteno z první produkce
            CisloRole_Zacatek = CisloRole_ZacF.replace(" ", "")
            CisloRoleOd2 = int(CisloRole_Zacatek) - Skip;
            CisloRoleOdF2 = str.zfill(str(CisloRoleOd2), int(CISLIC))  # doplnení zleva nulama
            CisloRoleOdF2 = Deleni3(CisloRoleOdF2)
            self.PoleCisloOd[k].SetValue(CisloRoleOdF2);
            CisloRole_KonF = self.PoleCisloDo[k].GetValue()  # načteno z první produkce
            CisloRole_Konec = CisloRole_KonF.replace(" ", "")
            CisloRoleDo2 = int(CisloRole_Konec) - Skip;
            CisloRoleDoF2 = str.zfill(str(CisloRoleDo2), int(CISLIC))  # doplnení zleva nulama
            CisloRoleDoF2 = Deleni3(CisloRoleDoF2)
            self.PoleCisloDo[k].SetValue(CisloRoleDoF2);
    def ButtonNahledTXT(self, Adresa):
        webbrowser.open(Cesta)  # náhled souborů TXT  # print (Cesta)
    def ComboBalil1(self, event):
        print(self.ComboBalil.GetValue())
        zamestnanec = self.ComboBalil.GetValue()
    def OnDate(self,event): # Sestava pro IGT. (event po výběru datumu z kalendáře)
        CisloZakazky = (self.Zakazka.GetValue())
        #CisloZakazky = ("{:0>7d}".format(CisloZakazky))
        Year = (self.Calendar.GetDate().GetYear())
        Month = (self.Calendar.GetDate().GetMonth());
        Month = ("{:0>2d}".format(Month + 1))  # !!!! Leden =0 !!!
        Day = (self.Calendar.GetDate().GetDay());
        Day = ("{:0>2d}".format(Day))
        Date1 = str(Day) + "." + str(Month) + "." + str(Year)
        TextakSazka(self, Date1,TextakSazka)  # protože nejde returnem vrátit proměnná do def (Seznam)
        #return (Date1)
        #wx.Window.Destroy(self.Calendar)
######################################
def Kontrola(JOB):
    app = wx.App(False)
    # print ("137 JOB",JOB)
    global frame1
    frame1 = wx.Frame(None, -1, "ROLE", size=(640, 820), pos=(940, 0))  # velikost plochy  Whole screen 1030,770
    MyPanel(frame1, -1, JOB)
    # MyPanel(Adresa,JOB,Serie,CisloOD,CiselNaRoli)
    frame1.Show(True)  # okno formuláře je otevřené
    app.MainLoop()

#Kontrola( "IGT_Sazka")

# https://www.himeport.co.jp/python/wxpython-wx-colourdatabase%E3%81%AE%E3%82%B5%E3%83%B3%E3%83%97%E3%83%AB%E8%89%B2%E8%A1%A8%E7%A4%BA%E3%83%97%E3%83%AD%E3%82%B0%E3%83%A9%E3%83%A0/
